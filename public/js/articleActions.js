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