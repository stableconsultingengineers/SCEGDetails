document.addEventListener('DOMContentLoaded', () => {
    const uploadZone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const uploadForm = document.getElementById('model-form');
    const uploadProgress = document.getElementById('upload-progress');
    const progressFill = document.getElementById('progress-fill');
    const uploadStatus = document.getElementById('upload-status');
    const uploadFormSection = document.getElementById('upload-form');
    const filePreview = document.getElementById('file-preview');
    const fileName = document.getElementById('file-name');
    const removeFileBtn = document.getElementById('remove-file');
    let selectedFile = null;

    // Show file dialog on click
    uploadZone.addEventListener('click', () => {
        fileInput.click();
    });

    // Drag and drop events
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });

    // File input change
    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Remove file button click
    removeFileBtn.addEventListener('click', () => {
        clearSelectedFile();
    });

    function handleFiles(files) {
        if (!files.length) return;
        
        const file = files[0];
        const validExtensions = ['glb', 'obj', 'fbx'];
        const extension = file.name.split('.').pop().toLowerCase();
        const maxSize = 50 * 1024 * 1024;
        
        if (!validExtensions.includes(extension)) {
            alert('Invalid file type. Please use GLB, OBJ, or FBX files.');
            return;
        }
        
        if (file.size > maxSize) {
            alert('File too large. Maximum size is 50MB.');
            return;
        }
        
        selectedFile = file;
        
        // Show file preview with name and remove button
        fileName.textContent = file.name;
        filePreview.classList.remove('hidden');
        
        // Show progress bar as ready
        uploadProgress.classList.remove('hidden');
        progressFill.style.width = '0%';
        uploadStatus.textContent = 'Ready to upload. Fill in the model information below.';
        uploadFormSection.classList.remove('hidden');
    }

    function clearSelectedFile() {
        selectedFile = null;
        fileInput.value = ''; // Clear the file input
        
        // Hide file preview
        filePreview.classList.add('hidden');
        fileName.textContent = '';
        
        // Hide upload form and progress
        uploadFormSection.classList.add('hidden');
        uploadProgress.classList.add('hidden');
        
        // Reset form
        uploadForm.reset();
    }

    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            alert('Please select a file first.');
            return;
        }

        // Ensure progress bar is visible
        uploadProgress.classList.remove('hidden');
        progressFill.style.width = '0%';
        uploadStatus.textContent = 'Starting upload...';

        const formData = new FormData();
        const inputs = uploadForm.querySelectorAll('input, select, textarea');
        
        // Get the base URL from the current window location
        const baseUrl = window.location.origin;
        
        formData.append('model', selectedFile);
        formData.append('name', inputs[1].value); // Title
        formData.append('category', inputs[2].value); // Category
        formData.append('description', inputs[3].value); // Description
        formData.append('materials', 'default'); // Default material
        formData.append('specifications', 'default'); // Default specification

        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${baseUrl}/api/upload`, true);

        // Update progress bar during upload
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                progressFill.style.width = `${percentComplete}%`;
                uploadStatus.textContent = `Uploading... ${Math.round(percentComplete)}%`;
                console.log(`Upload progress: ${percentComplete}%`); // Debug log
            }
        };

        xhr.onload = function() {
            if (xhr.status === 200) {
                const result = JSON.parse(xhr.responseText);
                if (result.success) {
                    progressFill.style.width = '100%';
                    uploadStatus.textContent = 'Upload complete!';
                    alert('Model uploaded successfully! Your model is now available in the library.');
                    
                    // Clear everything after successful upload
                    clearSelectedFile();
                    
                    // Redirect to browse page to see the new model
                    setTimeout(() => {
                        window.location.hash = 'browse'; // Use hash routing
                    }, 1500);
                } else {
                    uploadStatus.textContent = 'Upload failed.';
                    alert('Upload failed: ' + result.error);
                }
            } else {
                uploadStatus.textContent = 'Error uploading.';
                alert('Error uploading file: ' + xhr.statusText);
            }
        };

        xhr.onerror = function() {
            uploadStatus.textContent = 'Error uploading.';
            alert('Error uploading file. Please try again.');
        };

        // Start the upload
        xhr.send(formData);
    });
});