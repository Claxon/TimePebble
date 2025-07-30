# SETTINGS
$intervalMinutes = 1

$host.UI.RawUI.WindowTitle = "Calendar Export Loop"

# Define paths for temporary and final CSV files, and a log file.
$tempCsvPath = Join-Path ([System.IO.Path]::GetTempPath()) "calendar_temp.csv"
$csvPath = Join-Path (Get-Location) "calendar.csv"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logPath = Join-Path $scriptDir "calendar_export_log.txt"

# Start logging all output to a file.
Start-Transcript -Path $logPath -Append

# Main loop to continuously export the calendar.
while ($true) {
    try {
        # Attempt to connect to Outlook, with retries.
        $maxRetries = 12
        $retry = 0
        $calendar = $null

        while ($retry -lt $maxRetries) {
            try {
                # Create a COM object for the Outlook Application.
                $outlook = New-Object -ComObject Outlook.Application
                $namespace = $outlook.GetNamespace("MAPI")
                $calendar = $namespace.GetDefaultFolder(9) # 9 corresponds to the Calendar folder.
                if ($calendar) { break } # Exit loop if connection is successful.
            } catch {
                # Catch any errors and continue retrying.
            }
            Start-Sleep -Seconds 5
            $retry++
        }

        if (-not $calendar) {
            Write-Output "Outlook not available. Skipping this run."
        } else {
            # Define the date range for the calendar export.
            # If the CSV already exists, perform a lighter export. Otherwise, do a full initial export.
            if (Test-Path $csvPath) {
                # Light mode: small window to detect recent and upcoming changes.
                $rangeStart = (Get-Date).AddDays(-1)
                $rangeEnd = (Get-Date).AddDays(7)
                Write-Output "[$(Get-Date)] Performing light export (1 day back, 7 days ahead)."
            } else {
                # First run: full export window.
                $rangeStart = (Get-Date).AddDays(-1)
                $rangeEnd = (Get-Date).AddDays(7)
                Write-Output "[$(Get-Date)] No existing CSV found. Performing full export (7 days ahead)."
            }

            # Collect and filter calendar items based on the date range.
            $items = $calendar.Items
            $items.Sort("[Start]")
            $items.IncludeRecurrences = $true
            $filter = "[Start] >= '" + $rangeStart.ToString("g") + "' AND [End] <= '" + $rangeEnd.ToString("g") + "'"
            $restrictedItems = $items.Restrict($filter)

            # Initialize an array to hold CSV data and add the header row.
            $csvData = @()
            $csvData += '"subject","start","end","description","rsvp","private","ooo","entryid"'

            # Loop through each calendar item.
            foreach ($item in $restrictedItems) {
                if ($item -and $item.MessageClass -eq "IPM.Appointment" -and $item.Start -and $item.End) {
                    $isPrivate = $item.Sensitivity -eq 2 # 2 means private.

                    # **MODIFIED LINES**
                    # Prepare subject and description.
                    # For non-private events, escape any double quotes by replacing them with two double quotes ("").
                    # Newlines are no longer replaced with spaces, allowing them to be preserved.
                    $subject = if ($isPrivate) { "Private Event" } else { $item.Subject -replace '"', '""' }
                    $description = if ($isPrivate) { "Details hidden" } else { $item.Body -replace '"', '""' }
                    
                    $entryId = $item.EntryID

                    # Determine the RSVP status of the meeting.
                    $rsvpStatus = switch ($item.MeetingStatus) {
                        1 { "organizer" }
                        2 { "tentative" }
                        3 { "accepted" }
                        4 { "declined" }
                        default { "none" }
                    }

                    # Determine if the event is marked as private or out-of-office.
                    $privateStr = if ($isPrivate) { "yes" } else { "no" }
                    $oooStr = if ($item.BusyStatus -eq 3) { "yes" } else { "no" } # 3 means Out of Office.

                    # Construct the CSV row, ensuring all fields are quoted.
                    $csvData += '"{0}","{1}","{2}","{3}","{4}","{5}","{6}","{7}"' -f `
                        $subject, `
                        $item.Start.ToString("yyyy-MM-dd HH:mm:ss"), `
                        $item.End.ToString("yyyy-MM-dd HH:mm:ss"), `
                        $description, `
                        $rsvpStatus, `
                        $privateStr, `
                        $oooStr, `
                        $entryId
                }
            }

            # Write the collected data to a temporary CSV file.
            $csvData | Out-File -Encoding UTF8 -FilePath $tempCsvPath

            # Check if the new data is different from the existing data.
            $hasChanged = $true
            if (Test-Path $csvPath) {
                $originalHash = Get-FileHash -Path $csvPath -Algorithm SHA256
                $newHash = Get-FileHash -Path $tempCsvPath -Algorithm SHA256
                $hasChanged = $originalHash.Hash -ne $newHash.Hash
            }

            if ($hasChanged) {
                # If changes are detected, replace the old file and upload to FTP.
                Copy-Item -Path $tempCsvPath -Destination $csvPath -Force
                Write-Output "[$(Get-Date)] Changes detected. File updated and uploaded."

                # FTP Upload Details
                $ftpServer = "ftp://ftp.fasthosts.co.uk/htdocs/calendar.csv"
                $ftpUsername = "claxon"
                $ftpPassword = "&Q6Ue#uoomUKeir1" # Consider storing credentials more securely.

                # Create and configure the FTP request.
                $ftpRequest = [System.Net.FtpWebRequest]::Create($ftpServer)
                $ftpRequest.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
                $ftpRequest.Credentials = New-Object System.Net.NetworkCredential($ftpUsername, $ftpPassword)
                $ftpRequest.UseBinary = $true
                $ftpRequest.UsePassive = $true

                # Read the file content and write it to the FTP stream.
                $fileContent = [System.IO.File]::ReadAllBytes($csvPath)
                $ftpStream = $ftpRequest.GetRequestStream()
                $ftpStream.Write($fileContent, 0, $fileContent.Length)
                $ftpStream.Close()

                Write-Output "[$(Get-Date)] File uploaded to FTP."
            } else {
                Write-Output "[$(Get-Date)] No changes detected."
            }

            # Clean up the temporary file.
            if (Test-Path $tempCsvPath) {
                Remove-Item $tempCsvPath -Force
            }
        }
    } catch {
        # Log any unexpected errors that occur in the main loop.
        Write-Error "[$(Get-Date)] Unexpected error: $_"
    }

    # Wait for the specified interval before the next run.
    Start-Sleep -Seconds ($intervalMinutes * 60)
}

# Stop-Transcript # This line is commented out as the script runs in an infinite loop.
