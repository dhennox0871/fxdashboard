Add-Type -AssemblyName System.Drawing
$icon = New-Object System.Drawing.Icon("c:\laragon\www\oslank\oslank_mobile\assets\FXT_Icon.ico")
$bmp = $icon.ToBitmap()
$bmp.Save("c:\laragon\www\oslank\oslank_mobile\assets\images\FXT_Icon.png", [System.Drawing.Imaging.ImageFormat]::Png)
