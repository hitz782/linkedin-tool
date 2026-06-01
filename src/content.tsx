import React from 'react';
import { createRoot } from 'react-dom/client';


console.log("LinkedIn Extension Loaded");

function findPostText(element: HTMLElement): string {
    let current: HTMLElement | null = element;
    let postContainer: HTMLElement | null = null;
    
    while (current && current !== document.body) {
        if (
            current.tagName === 'ARTICLE' ||
            current.matches('.feed-shared-update-v2, .feed-shared-update, [data-urn], [data-activity-urn]') ||
            current.classList.contains('occludable-update') ||
            current.classList.contains('update-components-actor__container')
        ) {
            postContainer = current;
            break;
        }
        current = current.parentElement;
    }

    if (!postContainer) {
        let temp = element.parentElement;
        for (let i = 0; i < 5 && temp && temp !== document.body; i++) {
            if (temp.querySelector('.comments-comment-box') && temp !== element) {
                postContainer = temp;
                break;
            }
            temp = temp.parentElement;
        }
    }

    if (postContainer) {
        const descriptionEl = postContainer.querySelector(
            '.feed-shared-update-v2__description, ' +
            '.update-components-text, ' +
            '[class*="update-v2__description"], ' +
            '.feed-shared-text, ' +
            '[class*="show-more-text"], ' +
            '[class*="commentary"]'
        );
        if (descriptionEl) {
            return (descriptionEl as HTMLElement).innerText.trim();
        }

        const clone = postContainer.cloneNode(true) as HTMLElement;
        const commentSection = clone.querySelector('.comments-comment-list, .feed-shared-update-v2__comments-container, .comments-comment-box');
        if (commentSection) {
            commentSection.remove();
        }
        return clone.innerText.trim();
    }
    return '';
}

function AIButton() {
    const [comments, setComments] = React.useState<string[]>([]);
    const [showPopover, setShowPopover] = React.useState(false);
    const [loading, setLoading] = React.useState(false);
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);

    const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
        try {
            setLoading(true);
            const button = event.currentTarget;
            const scrapedText = findPostText(button);
            console.log('Scraped post content:', scrapedText);

            const response = await chrome.runtime.sendMessage({ 
                action: 'GENERATE_COMMENTS', 
                text: scrapedText 
            });
            console.log('Generated comments response:', response);

            if (Array.isArray(response)) {
                setComments(response);
                setShowPopover(true);
            }
        } catch (error) {
            console.error('Error generating comments:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCommentSelect = (comment: string) => {
        const button = buttonRef.current;
        if (!button) return;

        const commentBox = button.closest(
            '.comments-comment-box, ' +
            '.comments-comment-box__form-container, ' +
            '.comments-comment-box__form'
        ) || button.parentElement;

        if (commentBox) {
            const textbox = commentBox.querySelector('.ql-editor, [role="textbox"]') as HTMLElement | null;
            if (textbox) {
                textbox.focus();
                
                const p = textbox.querySelector('p');
                if (p) {
                    p.textContent = comment;
                } else {
                    textbox.innerHTML = `<p>${comment}</p>`;
                }

                // Dispatch events to let LinkedIn's React state know the input has changed
                textbox.dispatchEvent(new Event('input', { bubbles: true }));
                textbox.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        setShowPopover(false);
    };

    return (
        <div style={{ position: 'relative', display: 'inline-block' }}>
            <button
                ref={buttonRef}
                onClick={handleClick}
                disabled={loading}
                style={{
                    padding: '6px 12px',
                    backgroundColor: '#0a66c2',
                    color: 'white',
                    border: 'none',
                    borderRadius: '16px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    margin: '4px'
                }}
            >
                {loading ? '⏳ Generating...' : '✨ AI'}
            </button>
            {showPopover && comments.length > 0 && (
                <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: '0',
                    marginTop: '6px',
                    backgroundColor: 'white',
                    border: '1px solid #dadada',
                    borderRadius: '8px',
                    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.15)',
                    padding: '6px',
                    zIndex: 10000,
                    minWidth: '220px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                }}>
                    {comments.map((comment, index) => (
                        <button
                            key={index}
                            onClick={() => handleCommentSelect(comment)}
                            style={{
                                padding: '8px 12px',
                                textAlign: 'left',
                                backgroundColor: 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '13px',
                                color: '#333',
                                outline: 'none',
                                whiteSpace: 'normal',
                                wordBreak: 'break-word',
                                display: 'block',
                                width: '100%',
                                transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f3f3f3')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                            {comment}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

function injectAIButton(commentBox: HTMLElement) {
    if (commentBox.querySelector('.ai-injected-button')) return;

    const container = document.createElement('div');
    container.className = 'ai-injected-button';
    container.style.display = 'inline-flex';
    container.style.alignItems = 'center';

    // Find the emoji button, attachment button, or any button group inside the comment box
    const targetElement = commentBox.querySelector(
        '.comments-comment-box__emoji-trigger, ' +
        '.comments-comment-box__attachment-trigger, ' +
        '[class*="emoji-trigger"], ' +
        '[class*="attachment-trigger"]'
    ) || commentBox.querySelector(
        'button[aria-label*="emoji"], ' +
        'button[aria-label*="photo"], ' +
        'button[aria-label*="image"]'
    );

    if (targetElement && targetElement.parentElement) {
        targetElement.parentElement.insertBefore(container, targetElement);
    } else {
        // Fallback: append inside the comment box form or container
        const formContainer = commentBox.querySelector(
            '.comments-comment-box__form, ' +
            '.comments-comment-box__form-container, ' +
            '.comments-comment-box__editor'
        ) || commentBox;
        formContainer.appendChild(container);
    }

    const root = createRoot(container);
    root.render(<AIButton />);
}

function findCommentBoxes(root: HTMLElement | Document): HTMLElement[] {
    const boxes: HTMLElement[] = [];
    const editors = root.querySelectorAll('.ql-editor, [role="textbox"]');
    
    editors.forEach((editor) => {
        const container = editor.closest(
            '.comments-comment-box, ' +
            '.comments-comment-box__form-container, ' +
            '.comments-comment-box__form'
        ) || editor.parentElement;

        if (container && container instanceof HTMLElement && !boxes.includes(container)) {
            boxes.push(container);
        }
    });

    return boxes;
}

const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
        mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
                findCommentBoxes(node).forEach(injectAIButton);
            }
        });
    }
});

observer.observe(document.body, { childList: true, subtree: true });

findCommentBoxes(document).forEach(injectAIButton);
