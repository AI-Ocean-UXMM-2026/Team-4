Add-Type -AssemblyName System.Drawing
$previewFolder = Join-Path $PSScriptRoot '../../.artifacts/workbook-previews'
foreach ($persona in @('tea-shop', 'grocery', 'workshop', 'YOUR_BUSINESS_ID')) {
    $files = @(Get-ChildItem -LiteralPath $previewFolder -Filter ($persona + '-*.png') | Where-Object { $_.Name -notlike '*-contact.png' })
    $canvas = New-Object System.Drawing.Bitmap(1500, 1400)
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $graphics.Clear([System.Drawing.Color]::White)
    $font = New-Object System.Drawing.Font('Arial', 12)
    for ($index = 0; $index -lt $files.Count; $index++) {
        $img = [System.Drawing.Image]::FromFile($files[$index].FullName)
        $x = ($index % 2) * 750
        $y = [math]::Floor($index / 2) * 230
        $graphics.DrawString($files[$index].BaseName, $font, [System.Drawing.Brushes]::Black, $x, $y)
        $scale = [math]::Min(740 / $img.Width, 190 / $img.Height)
        $graphics.DrawImage($img, $x, $y + 25, [int]($img.Width * $scale), [int]($img.Height * $scale))
        $img.Dispose()
    }
    $canvas.Save((Join-Path $previewFolder ($persona + '-contact.png')))
    $graphics.Dispose()
    $canvas.Dispose()
}
