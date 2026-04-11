document.addEventListener('DOMContentLoaded', async () => {
    const settingsMap = {
        'im-toggle': 'im_enabled',
        'im-messages': 'im_messages',
        'auto-save': 'autosave_enabled',
    };

    const settings = await browser.storage.sync.get({
        im_enabled: true,
        im_messages: true,
        autosave_enabled: true,
    });

    Object.entries(settingsMap).forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.checked = settings[key];
    });

    document.querySelector('main').addEventListener('change', async (e) => {
        const key = settingsMap[e.target.id];
        if (key) {
            await browser.storage.sync.set({ [key]: e.target.checked });
        }
    });
});
