$outlook = New-Object -ComObject Outlook.Application
$namespace = $outlook.GetNamespace("MAPI")
$calendar = $namespace.GetDefaultFolder(9)

$csvPath = Join-Path (Get-Location) "calendar.csv"
$csv = @()
$csv += '"subject","start","end","description","rsvp","private","ooo"'

$rangeStart = (Get-Date).AddDays(-1)
$rangeEnd = (Get-Date).AddDays(30)

$items = $calendar.Items
$items.Sort("[Start]")
$items.IncludeRecurrences = $true

$filter = "[Start] >= '" + $rangeStart.ToString("g") + "' AND [End] <= '" + $rangeEnd.ToString("g") + "'"
$restrictedItems = $items.Restrict($filter)

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

$csv | Out-File -Encoding UTF8 $csvPath
Write-Output "CSV with OOO detection exported to $csvPath"
