async function updateStatus(currentArticleId) {
    const { value: newStatus } = await Swal.fire({
        title: 'Update Article Status',
        input: 'select',
        inputOptions: {
            'unread': 'Unread',
            'reading': 'Reading',
            'read': 'Read',
            'later': 'Read Later',
            'archived': 'Archived'
        },
        inputPlaceholder: 'Select a status',
        showCancelButton: true,
        confirmButtonColor: '#6366f1',
        inputValidator: (value) => {
            return new Promise((resolve) => {
                if (value) {
                    resolve();
                } else {
                    resolve('You need to select a status!');
                }
            });
        }
    });

    if (newStatus) {
        try {
            const response = await fetch(`/articles/${currentArticleId}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });

            const data = await response.json();

            if (response.ok) {
                Swal.fire({
                    icon: 'success',
                    title: 'Status Updated',
                    text: `Article is now marked as ${newStatus}.`,
                    toast: true,
                    position: 'top-end',
                    timer: 3000,
                    showConfirmButton: false
                });
            } else {
                throw new Error(data.error || 'Failed to update status');
            }
        } catch (err) {
            Swal.fire('Error', err.message, 'error');
        }
    }
}

// Listen for all click events on the document
document.addEventListener('click', async (e) => {
    // Find the closest anchor (<a>) tag from the clicked element
    const link = e.target.closest('a');

    // Skip if: 
    // 1. No link was clicked
    // 2. Link opens in a new tab (_blank)
    // 3. Link is a javascript action (e.g., javascript:void(0))
    if (!link || link.target === '_blank' || link.href.includes('javascript:')) return;

    const destination = link.href;

    // Skip if the link is just an anchor/hash jump on the same page
    if (destination.startsWith(window.location.origin + window.location.pathname + '#')) return;

    // Prevent the default browser navigation
    e.preventDefault();

    // Show a confirmation dialog using SweetAlert2
    const result = await Swal.fire({
        title: 'Save changes?',
        text: 'You are leaving this page. Do you want to sync your changes to the database first?',
        icon: 'question',
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: 'Save & Exit',
        denyButtonText: 'Exit without saving',
        cancelButtonText: 'Stay here',
        confirmButtonColor: '#3085d6',
        denyButtonColor: '#d33',
    });

    // Handle user choices
    if (result.isConfirmed) {
        // User clicked "Save & Exit"
        const currentContent = vditor.getValue();
        try {
            await saveToDB(currentContent); // Wait for the database sync
            window.location.href = destination; // Navigate after success
        } catch (err) {
            console.error("Navigation halted due to save error.");
        }
    } else if (result.isDenied) {
        // User clicked "Exit without saving"
        window.location.href = destination; // Navigate immediately
    }
    // If user clicked "Stay here" (Cancel), do nothing and remain on the page
});

async function saveToDB(article) {
    if (!article) {
        return Swal.fire('Wait!', 'Content is empty.', 'warning');
    }

    try {
        const response = await fetch(`/articles/${articleId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ article: article })
        });

        if (response.ok) {
            Swal.fire({
                icon: 'success',
                title: 'Saved!',
                text: 'Changes synchronized to database.',
                timer: 2000,
                showConfirmButton: false
            });
        } else {
            throw new Error('Save failed');
        }
    } catch (err) {
        Swal.fire('Save Error', err.message, 'error');
    }
}