# Files to delete
$filesToDelete = @(
    # Viewer components
    "c:\Users\vivek\coop editor\src\components\viewers\PDFViewer.jsx",
    "c:\Users\vivek\coop editor\src\components\viewers\PowerPointViewer.jsx",
    "c:\Users\vivek\coop editor\src\components\viewers\WordViewer.jsx",
    
    # Editor components
    "c:\Users\vivek\coop editor\src\components\editors\PDFEditor.jsx",
    "c:\Users\vivek\coop editor\src\components\editors\PowerPointEditor.jsx",
    "c:\Users\vivek\coop editor\src\components\editors\WordEditor.jsx",
    
    # File management
    "c:\Users\vivek\coop editor\src\components\FileUpload.jsx",
    "c:\Users\vivek\coop editor\src\components\DocumentEditor.jsx",
    
    # CSS files
    "c:\Users\vivek\coop editor\src\components\viewers\PowerPointViewer.css",
    "c:\Users\vivek\coop editor\src\components\viewers\WordViewer.css",
    "c:\Users\vivek\coop editor\src\components\editors\PDFEditor.css",
    "c:\Users\vivek\coop editor\src\components\editors\PowerPointEditor.css",
    "c:\Users\vivek\coop editor\src\components\editors\WordEditor.css",
    "c:\Users\vivek\coop editor\src\components\DocumentEditor.css",
    
    # Video component
    "c:\Users\vivek\coop editor\src\components\VideoPlayer.jsx"
)

# Count to track how many files were actually deleted
$deletedCount = 0

# Delete each file if it exists
foreach ($file in $filesToDelete) {
    if (Test-Path $file) {
        Write-Host "Deleting: $file"
        Remove-Item $file -Force
        $deletedCount++
    } else {
        Write-Host "File not found, skipping: $file"
    }
}

Write-Host "Deletion complete. $deletedCount files were deleted."

# Also let's clean up the directories if they're empty
$dirsToCheck = @(
    "c:\Users\vivek\coop editor\src\components\viewers",
    "c:\Users\vivek\coop editor\src\components\editors"
)

foreach ($dir in $dirsToCheck) {
    if ((Test-Path $dir) -and ((Get-ChildItem $dir -Force | Measure-Object).Count -eq 0)) {
        Write-Host "Removing empty directory: $dir"
        Remove-Item $dir -Force
    }
}
