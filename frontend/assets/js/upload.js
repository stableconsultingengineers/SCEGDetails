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

    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000';

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
        
        formData.append('file', selectedFile);
        formData.append('name', inputs[1].value); // Title
        formData.append('category', inputs[2].value); // Category
        formData.append('description', inputs[3].value); // Description
        formData.append('materials', 'default'); // Default material
        formData.append('specifications', 'default'); // Default specification

        try {
            const result = await uploadModel(formData);
            
            if (result.success) {
                progressFill.style.width = '100%';
                uploadStatus.textContent = 'File uploaded successfully!';
                alert('Model uploaded successfully! Your model is now available in the library.');
                
                // Clear everything after successful upload
                clearSelectedFile();
                
                // Redirect to browse page to see the new model
                setTimeout(() => {
                    showBrowse(); // Use the existing function from main script
                }, 1500);
            } else {
                uploadStatus.textContent = 'Upload failed: ' + result.message;
                alert('Upload failed: ' + result.message);
            }
        } catch (error) {
            uploadStatus.textContent = 'Error: ' + error.message;
            alert('Error uploading file: ' + error.message);
        }
    });

    async function uploadModel(formData) {
        try {
            const response = await fetch(`${API_URL}/api/upload`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error uploading model:', error);
            throw error;
        }
    }

    async function fetchModels() {
        try {
            const response = await fetch(`${API_URL}/api/models`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching models:', error);
            throw error;
        }
    }
});