async function handleDailySync(event) {
    // Explicitly pass event or use window.event if necessary
    const btn = event.currentTarget;
    const originalContent = btn.innerHTML;

    // 1. Prevent multiple clicks
    btn.disabled = true;

    // 2. Add a smoother loading state 
    // We use a fixed height/width or keep the icon to prevent the button from "shrinking"
    btn.innerHTML = `
        <svg class="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span class="ml-2">SYNCING...</span>
    `;

    try {
        const response = await fetch('/api/daily-sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            // Success: Add a quick visual "Checkmark" before reloading for satisfaction
            btn.classList.replace('bg-slate-900', 'bg-emerald-500');
            btn.innerHTML = 'SUCCESS';

            setTimeout(() => {
                window.location.reload();
            }, 600);
        } else {
            throw new Error('Sync Failed');
        }
    } catch (err) {
        console.error('Sync Error:', err);

        // Error state: brief shake or red color
        btn.classList.replace('bg-slate-900', 'bg-rose-500');
        btn.innerHTML = 'FAILED';

        setTimeout(() => {
            btn.disabled = false;
            btn.classList.replace('bg-rose-500', 'bg-slate-900');
            btn.innerHTML = originalContent;
        }, 2000);
    }
}