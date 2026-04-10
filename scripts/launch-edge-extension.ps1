param(
    [string]$StartUrl = "https://hanja.dict.naver.com/#/search?query=%E5%A4%A9"
)

$edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$extensionPath = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path $edgePath)) {
    throw "Microsoft Edge was not found at '$edgePath'."
}

Start-Process -FilePath $edgePath -ArgumentList @(
    "--new-window",
    "--load-extension=$extensionPath",
    $StartUrl
)
