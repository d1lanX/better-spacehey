window.addEventListener('load', async () => {
    const leftSideElem = document.querySelector('.new-message>.left');
    const sendBtnElem = document.querySelector('.new-message>.right>button');
    const messageInputElem = document.querySelector(
        'textarea.message-composer',
    );
    let messageCounterElem;
    let redoBtnElem;
    let lastMessagesElem;

    let chatHistory;
    let currentMessage;
    let isInitialized = false;

    // chat watchers
    const messagesContainerElem = document.querySelector('.messages');
    const observer = new MutationObserver(onChangingChat);

    let lastChatterId = null;

    try {
        await init();
    } catch (err) {
        console.log('better-spacehey: ', err);
    }

    function onSendMessage() {
        if (!currentMessage) {
            console.log('better-spacehey: no message');
            return;
        }

        syncRedosHistory({
            messageObj: {
                message: currentMessage,
                date: Date.now(),
            },
        });
        currentMessage = '';
        renderChatHistory();
    }

    async function renderChatHistory() {
        messageCounterElem.innerHTML = chatHistory?.length
            ? chatHistory.length
            : '';
        lastMessagesElem.innerHTML =
            chatHistory
                ?.sort((a, b) => a.date - b.date)
                ?.map(
                    (m) => `<button data-id="${m.date}">${m.message}</button>`,
                )
                .join('<br>') || '';
    }

    function getRedoMessagesButton() {
        return (
            leftSideElem.querySelector('button.redo') ||
            Object.assign(document.createElement('button'), {
                className: 'redo',
                popoverTargetElement: lastMessagesElem,
                popoverTargetAction: 'toggle',
                innerHTML: `<svg xmlns="http://www.w3.org/2000/svg" class="svg-icon" width="24" height="24" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"></path><path d="M17 7h-6a5 5 0 1 0 0 10h1"></path><polyline points="17 3 21 7 17 11"></polyline></svg>`,
            })
        );
    }

    function getMessageCounterElem() {
        return (
            leftSideElem.querySelector('span.counter') ||
            Object.assign(document.createElement('span'), {
                className: 'counter',
            })
        );
    }

    function restoreMessage(e) {
        if (e.target.id === 'last-messages') return;
        const id = Number(e.target.dataset.id);
        const message = chatHistory.find((m) => m.date === id);
        currentMessage = message.message;
        messageInputElem.value = message.message;
    }

    function setCurrentMessage(e) {
        currentMessage = e.target.value;
    }

    function onKeyDown(e) {
        if (e.ctrlKey && e.keyCode == 13) {
            onSendMessage();
        }
    }

    function removeUI() {
        redoBtnElem?.remove();
        lastMessagesElem?.remove();
    }

    async function init() {
        const settings = await browser.storage.sync.get({
            im_enabled: true,
            im_messages: true,
        });

        if (settings.im_enabled) {
            sendBtnElem.addEventListener('click', onSendMessage);
            messageInputElem.addEventListener('keydown', onKeyDown);
            messageInputElem.addEventListener('input', setCurrentMessage);

            const storedData = (await browser.storage.sync.get('chat_history'))
                ?.chat_history;
            chatHistory = Array.isArray(storedData) ? storedData : [];
            setupUI();
        }

        if (settings.im_messages) {
            observer.observe(messagesContainerElem, {
                childList: true,
                subtree: false,
            });
        }

        browser.storage.onChanged.addListener((changes, area) => {
            if (area === 'sync' && 'im_enabled' in changes) {
                if (changes.im_enabled.newValue) {
                    setupUI();
                } else {
                    removeUI();
                }
            }

            if (area === 'sync' && 'im_messages' in changes) {
                if (changes.im_messages.newValue) {
                    observer.observe(messagesContainerElem, {
                        childList: true,
                        subtree: false,
                    });
                } else {
                    observer.disconnect();
                }
            }
        });

        isInitialized = true;
    }

    function setupUI() {
        // Prevent double injection
        if (leftSideElem.querySelector('.redo')) return;

        lastMessagesElem = document.createElement('div');
        lastMessagesElem.id = 'last-messages';
        lastMessagesElem.popover = 'auto';
        leftSideElem.appendChild(lastMessagesElem);

        redoBtnElem = getRedoMessagesButton();
        messageCounterElem = getMessageCounterElem();

        redoBtnElem.insertAdjacentElement('beforeend', messageCounterElem);
        redoBtnElem.style.cssText = 'position: relative;';
        leftSideElem.insertAdjacentElement('afterbegin', redoBtnElem);

        lastMessagesElem.addEventListener('click', restoreMessage);
        renderChatHistory();
    }

    async function syncRedosHistory({ messageObj }) {
        chatHistory.unshift(messageObj);
        if (chatHistory.length > 10) {
            chatHistory.pop();
        }
        await browser.storage.sync.set({ chat_history: chatHistory });
    }

    async function syncChatHistory({ userId, newMessages, lastMessageId }) {
        const { im_logs } = await browser.storage.local.get({ im_logs: {} });
        if (!im_logs[userId]) {
            im_logs[userId] = {
                user_id: userId,
                last_message_id: null,
                messages: [],
            };
        }

        const existingIds = new Set(im_logs[userId].messages.map((m) => m.id));
        const filteredNew = newMessages.filter((m) => !existingIds.has(m.id));

        if (filteredNew.length > 0) {
            im_logs[userId].messages.push(...filteredNew);
        }

        if (lastMessageId) {
            im_logs[userId].last_message_id = lastMessageId;
        }

        await browser.storage.local.set({ im_logs });
    }

    async function syncMessageDeletions({ userId, messageIds }) {
        if (!messageIds || messageIds.length === 0) return;

        const { im_logs } = await browser.storage.local.get({ im_logs: {} });
        if (!im_logs[userId]) return;

        const idSet = new Set(messageIds);
        let updated = false;

        im_logs[userId].messages.forEach((m) => {
            if (idSet.has(m.id) && !m.deleted) {
                m.deleted = true;
                updated = true;
            }
        });

        if (updated) {
            await browser.storage.local.set({ im_logs });
        }
    }

    function extractMessageData(node) {
        if (
            !node ||
            node.nodeType !== 1 ||
            !node.classList.contains('message-container')
        )
            return null;
        return {
            id: node.id,
            self: node.classList.contains('self'),
            content: node.querySelector('.message p')?.innerText,
            timestamp: node.querySelector('time.ago')?.dataset.timestamp,
        };
    }

    async function onChangingChat(mutations) {
        const chatterProfileUrl = document.querySelector(
            '.chat-header-profile-link',
        )?.href;
        if (!chatterProfileUrl) {
            console.log('better-spacehey: no chatter profile link');
            return;
        }

        const chatterId = new URL(chatterProfileUrl).searchParams.get('id');
        if (!chatterId) {
            console.log('better-spacehey: no chatter id');
            return;
        }

        const { im_logs } = await browser.storage.local.get({ im_logs: {} });
        const userLog = im_logs[chatterId] || { last_message_id: null };
        let lastStoredId = userLog.last_message_id;

        const newMessages = [];
        let latestFoundId = lastStoredId;

        const isOpeningNewChat =
            lastChatterId !== null && chatterId !== lastChatterId;

        const removedIds = [];

        if (isOpeningNewChat || lastChatterId === null) {
            // Full scan when switching chats or first initialization
            const allMessages =
                messagesContainerElem.querySelectorAll('.message-container');
            allMessages.forEach((node) => {
                const data = extractMessageData(node);
                if (data && data.id !== lastStoredId) {
                    newMessages.push(data);
                    latestFoundId = data.id;
                }
            });
        } else {
            // Process new mutations
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    const data = extractMessageData(node);
                    if (data && data.id !== lastStoredId) {
                        newMessages.push(data);
                        latestFoundId = data.id;
                    }
                });

                mutation.removedNodes.forEach((node) => {
                    if (
                        node.nodeType === 1 &&
                        node.classList.contains('message-container')
                    ) {
                        removedIds.push(node.id);
                    }
                });
            });
        }

        if (newMessages.length > 0) {
            await syncChatHistory({
                userId: chatterId,
                newMessages,
                lastMessageId: latestFoundId,
            });
        }

        if (removedIds.length > 0) {
            await syncMessageDeletions({
                userId: chatterId,
                messageIds: removedIds,
            });
        }

        // Handle the 150-message limit warning
        const limitInfo = messagesContainerElem.querySelector('.limit-info');
        if (limitInfo) {
            limitInfo.remove();
            if (!messagesContainerElem.querySelector('.load-more-messages')) {
                const btn = document.createElement('button');
                btn.className = 'load-more-messages';
                btn.innerText = 'Load Older Messages';
                btn.onclick = onLoadMoreClick;
                messagesContainerElem.insertAdjacentElement('afterbegin', btn);
            }
        }

        lastChatterId = chatterId;
    }

    function renderMessageHTML(m) {
        return `<div class="message-container ${m.self ? 'self' : 'other'}" id="${m.id}">
            <div class="message-container-inner">
                <div class="message"><p>${m.content}</p></div>
                <div class="message-footer"><time class="ago" data-timestamp="${m.timestamp}">${new Date(Number(m.timestamp) * 1000).toLocaleString()}</time></div>
            </div>
        </div>`;
    }

    async function onLoadMoreClick() {
        if (!lastChatterId) return;

        const { im_logs } = await browser.storage.local.get({ im_logs: {} });
        const history = im_logs[lastChatterId]?.messages || [];

        // Identify messages currently in DOM to avoid duplicates
        const domIds = new Set(
            [
                ...messagesContainerElem.querySelectorAll('.message-container'),
            ].map((el) => el.id),
        );

        // Filter history to find messages NOT in DOM and NOT soft-deleted
        const availableHistory = history.filter(
            (m) => !m.deleted && !domIds.has(m.id),
        );

        if (availableHistory.length === 0) {
            document.querySelector('.load-more-messages')?.remove();
            return;
        }

        // Take a chunk of 150 messages from the top (most recent of the "older" batch)
        const chunk = availableHistory.slice(-150);
        const html = chunk.map(renderMessageHTML).join('');
        const button = document.querySelector('.load-more-messages');

        // Preserve scroll position
        const oldScrollHeight = messagesContainerElem.scrollHeight;
        const oldScrollTop = messagesContainerElem.scrollTop;

        button.insertAdjacentHTML('afterend', html);

        // Adjust scroll position after prepending
        messagesContainerElem.scrollTop =
            messagesContainerElem.scrollHeight - oldScrollHeight + oldScrollTop;

        if (availableHistory.length <= 50) {
            button.remove();
        }
    }
});
