// Listen for the Actor Directory rendering
Hooks.on("renderActorDirectory", (app, html, data) => {
    // 1. Create the button HTML
    const pasteButton = $(`
        <button class="conan-pdf-parser-btn" style="flex: 0 0 100%; margin-top: 5px;">
            <i class="fas fa-file-pdf"></i> Paste Conan NPC
        </button>
    `);

    // 2. Inject the button into the Foundry UI
    // We append it to the action buttons area at the top of the sidebar
    html.find(".directory-header .action-buttons").append(pasteButton);

    // 3. Define what happens when the button is clicked
    pasteButton.on("click", (e) => {
        e.preventDefault();

        // Build the HTML for the dialog box
        const dialogContent = `
            <div class="form-group" style="display: flex; flex-direction: column; height: 100%;">
                <label style="margin-bottom: 10px;"><b>Paste NPC Stat Block from PDF:</b></label>
                <textarea id="conan-pdf-text" style="width: 100%; height: 300px; resize: none; font-family: monospace;"></textarea>
                <p class="notes" style="margin-top: 5px; font-size: 0.9em; color: var(--color-text-dark-secondary);">
                    Ensure you copy the entire block, from the name down to the last ability.
                </p>
            </div>
        `;

        // Create and render the Foundry Dialog
        new Dialog({
            title: "Conan Monolith PDF Parser",
            content: dialogContent,
            buttons: {
                parse: {
                    icon: '<i class="fas fa-magic"></i>',
                    label: "Parse & Create",
                    callback: (html) => {
                        // Grab the text from the textarea
                        const rawText = html.find("#conan-pdf-text").val();
                        
                        if (rawText.trim() === "") {
                            ui.notifications.warn("Cannot parse an empty text box!");
                            return;
                        }

                        // Send it to the parser logic we built in parser.js
                        if (window.ConanPDFParser) {
                            window.ConanPDFParser.parseAndCreate(rawText);
                        } else {
                            ui.notifications.error("Parser logic not found. Make sure parser.js loaded correctly.");
                        }
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: "Cancel"
                }
            },
            default: "parse",
            // Give the window a reasonable size so the textarea has room
            render: html => console.log("Conan PDF Parser dialog rendered."),
        }, { width: 500, height: 450 }).render(true);
    });
});