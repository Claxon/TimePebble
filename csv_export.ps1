# SETTINGS
$intervalMinutes = 1

$host.UI.RawUI.WindowTitle = "Calendar Export Loop"

$tempCsvPath = Join-Path ([System.IO.Path]::GetTempPath()) "calendar_temp.csv"
$csvPath = Join-Path (Get-Location) "calendar.csv"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logPath = Join-Path $scriptDir "calendar_export_log.txt"
Start-Transcript -Path $logPath -Append

while ($true) {
    try {
        # Wait for Outlook to be available
        $maxRetries = 12
        $retry = 0
        $calendar = $null

        while ($retry -lt $maxRetries) {
            try {
                $outlook = New-Object -ComObject Outlook.Application
                $namespace = $outlook.GetNamespace("MAPI")
                $calendar = $namespace.GetDefaultFolder(9)
                if ($calendar) { break }
            } catch {}
            Start-Sleep -Seconds 5
            $retry++
        }

        if (-not $calendar) {
            Write-Output "Outlook not available. Skipping this run."
        } else {
            # Date range
            # Smarter export range
			if (Test-Path $csvPath) {
				# Light mode: small window to detect recent and upcoming changes
				$rangeStart = (Get-Date).AddDays(-1)
				$rangeEnd = (Get-Date).AddDays(7)
				Write-Output "[$(Get-Date)] Performing light export (1 day back, 7 days ahead)."
			} else {
				# First run: full export window
				$rangeStart = (Get-Date).AddDays(-1)
				$rangeEnd = (Get-Date).AddDays(7)
				Write-Output "[$(Get-Date)] No existing CSV found. Performing full export (7 days ahead)."
			}


            # Collect calendar items
            $items = $calendar.Items
            $items.Sort("[Start]")
            $items.IncludeRecurrences = $true
            $filter = "[Start] >= '" + $rangeStart.ToString("g") + "' AND [End] <= '" + $rangeEnd.ToString("g") + "'"
            $restrictedItems = $items.Restrict($filter)

            $csv = @()
            $csv += '"subject","start","end","description","rsvp","private","ooo"'

            foreach ($item in $restrictedItems) {
                if ($item -and $item.MessageClass -eq "IPM.Appointment" -and $item.Start -and $item.End) {
                    $isPrivate = $item.Sensitivity -eq 2
                    $subject = if ($isPrivate) { "Private Event" } else { ($item.Subject -replace '"', "'") -replace '\r|\n', ' ' }
                    $description = if ($isPrivate) { "Details hidden" } else { ($item.Body -replace '"', "'") -replace '\r|\n', ' ' }

                    $rsvpStatus = switch ($item.MeetingStatus) {
                        1 { "organizer" }
                        2 { "tentative" }
                        3 { "accepted" }
                        4 { "declined" }
                        default { "none" }
                    }

                    $privateStr = if ($isPrivate) { "yes" } else { "no" }
                    $oooStr = if ($item.BusyStatus -eq 3) { "yes" } else { "no" }

                    $csv += '"{0}","{1}","{2}","{3}","{4}","{5}","{6}"' -f `
                        $subject, `
                        $item.Start.ToString("yyyy-MM-dd HH:mm:ss"), `
                        $item.End.ToString("yyyy-MM-dd HH:mm:ss"), `
                        $description, `
                        $rsvpStatus, `
                        $privateStr, `
                        $oooStr
                }
            }

            # Write to temp CSV
            $csv | Out-File -Encoding UTF8 $tempCsvPath

            # Compare and update if changed
            $hasChanged = $true
            if (Test-Path $csvPath) {
                $originalHash = Get-FileHash -Path $csvPath -Algorithm SHA256
                $newHash = Get-FileHash -Path $tempCsvPath -Algorithm SHA256
                $hasChanged = $originalHash.Hash -ne $newHash.Hash
            }

            if ($hasChanged) {
                Copy-Item -Path $tempCsvPath -Destination $csvPath -Force
                Write-Output "[$(Get-Date)] Changes detected. File updated and uploaded."

                # FTP Upload
                $ftpServer = "ftp://ftp.fasthosts.co.uk/htdocs/calendar.csv"
                $ftpUsername = "claxon"
                $ftpPassword = "&Q6Ue#uoomUKeir1"

                $ftpRequest = [System.Net.FtpWebRequest]::Create($ftpServer)
                $ftpRequest.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
                $ftpRequest.Credentials = New-Object System.Net.NetworkCredential($ftpUsername, $ftpPassword)
                $ftpRequest.UseBinary = $true
                $ftpRequest.UsePassive = $true

                $fileContent = [System.IO.File]::ReadAllBytes($csvPath)
                $ftpStream = $ftpRequest.GetRequestStream()
                $ftpStream.Write($fileContent, 0, $fileContent.Length)
                $ftpStream.Close()

                Write-Output "[$(Get-Date)] File uploaded to FTP."
            } else {
                Write-Output "[$(Get-Date)] No changes detected."
            }

            # Clean up
            if (Test-Path $tempCsvPath) {
                Remove-Item $tempCsvPath -Force
            }
        }
    } catch {
        Write-Error "[$(Get-Date)] Unexpected error: $_"
    }

    # Wait before next loop
    Start-Sleep -Seconds ($intervalMinutes * 60)
}

# Stop-Transcript
