window.addEventListener('load', () => {
    let drafts = [];

    let currentBlog = {
        subject: '',
        category: '',
        content: '',
        privacy: 'public',
        comments: 'enabled',
        startedAt: Date.now(),
    };

    const sidebar = document.querySelector('main>.row>.col.left');
    const form = document.querySelector('form.ctrl-enter-submit');
    const content = document.querySelector(
        '.trumbowyg-editor[contenteditable]',
    );

    const throttledStoreContent = throttle(storeContent, 2000);

    form.addEventListener('change', storeDetails);
    content.addEventListener('input', (e) => throttledStoreContent(e));

    init().catch(console.error);

    function storeDetails(e) {
        const target = e.target.name;
        currentBlog[target] = e.target?.value || '';
        syncStorage();
    }

    function storeContent(e) {
        currentBlog.content = e.target.innerHTML;
        syncStorage();
    }

    async function syncStorage(fromDelete = false) {
        const index = drafts.findIndex(
            (d) => d.startedAt === currentBlog.startedAt,
        );
        if (index !== -1) {
            drafts[index] = { ...currentBlog };
        } else if (index === -1 && fromDelete) {
            drafts = drafts;
        } else {
            drafts.push({ ...currentBlog });
        }
        await browser.storage.sync.set({ drafts: drafts });
        renderDrafts(drafts);
    }

    function throttle(cb, ms = 2000) {
        let timeout;
        return (...args) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                cb(...args);
            }, ms);
        };
    }

    function getDraftsContainer() {
        return (
            sidebar.querySelector('.edit-info.drafts') ||
            sidebar.appendChild(
                Object.assign(document.createElement('div'), {
                    className: 'edit-info drafts',
                    innerHTML: '<b>Drafts</b>',
                }),
            )
        );
    }

    function renderDrafts(drafts) {
        const listItems = drafts
            .map(
                (d) =>
                    `<li>
            <p><i><b>${d.subject}</b></i><br /><small>${d.content.length} chars. | started: ${new Date(d.startedAt).toLocaleTimeString()}</small>
            <button type="button" id="_cont" data-id="${d.startedAt}">Continue</button>
            <button type="button" id="_del" data-id="${d.startedAt}">Delete</button>
            </p>
        </li>`,
            )
            .join('');

        getDraftsContainer().innerHTML = `<b>Drafts</b>${drafts.length ? `<ul>${listItems}</ul>` : '<p>No drafts yet.</p>'}`;
        setupDraftsListeners();
    }

    function deleteDraft(id) {
        drafts = drafts.filter((d) => d.startedAt !== id);
        syncStorage(true);
    }

    function continueDraft(id) {
        const draft = drafts.find((d) => d.startedAt === id);
        currentBlog = draft;
        restoreDraft(draft);
    }

    function restoreDraft(draft) {
        for (const [key, value] of Object.entries(draft)) {
            if (key === 'startedAt') continue;
            if (key === 'content') {
                content.innerHTML = value;
                continue;
            }

            const el = document.querySelector(`[name="${key}"]`);

            if (el.type === 'radio') {
                const radio = document.querySelector(
                    `[name="${key}"][value="${value}"]`,
                );
                radio.checked = true;
                continue;
            }

            if (el) {
                el.value = value;
            }
        }
    }

    function setupDraftsListeners() {
        const container = getDraftsContainer();
        container.addEventListener('click', async (e) => {
            const pairs = {
                _cont: continueDraft,
                _del: deleteDraft,
            };
            await pairs[e.target.id](Number(e.target.dataset.id));
        });
    }

    async function init() {
        const res = await browser.storage.sync.get('drafts');
        drafts = res.drafts || [];
        renderDrafts(drafts);
    }
});
