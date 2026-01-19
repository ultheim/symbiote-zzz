// ============================================
// MAIN COORDINATOR (main.js)
// ============================================

window.currentMood = "NEUTRAL";
window.glitchMode = false;
window.questionMode = false; 
window.directorMode = false; // MOVED HERE: Global flag
window.textMode = false; 
window.viewingHistory = false; 
window.mediaTimeout = null;

window.MOOD_AUDIO = {
    "NEUTRAL": { fShift: 1.0, speed: 1.0 },
    "AFFECTIONATE": { fShift: 0.8, speed: 1.3 }, 
    "CRYPTIC": { fShift: 0.9, speed: 1.0 },
    "DISLIKE": { fShift: 1.5, speed: 0.6 },     
    "JOYFUL": { fShift: 1.2, speed: 0.9 },
    "CURIOUS": { fShift: 1.3, speed: 1.1 },
    "SAD": { fShift: 0.6, speed: 1.8 },
    "GLITCH": { fShift: 2.0, speed: 0.4 },
    "QUESTION": { fShift: 1.1, speed: 0.9 } 
};

window.PALETTES = {
    "NEUTRAL":     { pri: {r:255, g:255, b:255}, sec: {r:100, g:100, b:100}, conn: {r:80, g:80, b:80} },
    "AFFECTIONATE":{ pri: {r:255, g:50,  b:150}, sec: {r:150, g:20,  b:80},  conn: {r:100, g:0,  b:50} }, 
    "CRYPTIC":     { pri: {r:0,   g:255, b:150}, sec: {r:0,   g:100, b:60},  conn: {r:0,   g:80,  b:40} }, 
    "DISLIKE":     { pri: {r:255, g:0,   b:0},   sec: {r:150, g:0,   b:0},   conn: {r:100, g:0,  b:0} }, 
    "JOYFUL":      { pri: {r:255, g:220, b:0},   sec: {r:180, g:150, b:0},  conn: {r:130, g:100, b:0} }, 
    "CURIOUS":     { pri: {r:0,   g:150, b:255}, sec: {r:0,   g:80,  b:180}, conn: {r:0,   g:60,  b:140} }, 
    "SAD":         { pri: {r:50,  g:50,  b:255}, sec: {r:20,  g:20,  b:150}, conn: {r:10,  g:10,  b:100} },
    "QUESTION":    { pri: {r:200, g:220, b:255}, sec: {r:20,  g:30,  b:80},  conn: {r:40,  g:50,  b:100} } 
};

let USER_API_KEY = localStorage.getItem("symbiosis_api_key") || "";
const OPENROUTER_MODEL = "x-ai/grok-4.1-fast"; 

let chatHistory = []; 

function enableDragScroll(slider) {
    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.classList.add('active'); // Optional: Add css for cursor: grabbing
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => { isDown = false; });
    slider.addEventListener('mouseup', () => { isDown = false; });
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; // Scroll-fast multiplier
        slider.scrollLeft = scrollLeft - walk;
    });
}

// --- TOGGLE MODES ---
window.toggleMode = function() {
    window.textMode = !window.textMode;
    const btn = document.getElementById('modeBtn');
    if (btn) btn.textContent = window.textMode ? "TEXT" : "AUDIO";
    window.speak("MODE SWITCHED.");
};

// --- TERMINAL HISTORY LOGIC ---
window.addToHistory = function(role, text, graphData = null) {
    const container = document.getElementById('terminal-content');
    if(!container) return; 
    const div = document.createElement('div');
    div.className = 'term-msg';
    
    const meta = document.createElement('div');
    meta.className = 'term-meta';
    meta.textContent = `[${new Date().toLocaleTimeString()}] // ${role.toUpperCase()}`;
    
    const content = document.createElement('div');
    content.className = role === 'user' ? 'term-user' : 'term-ai';
    content.textContent = text;

    // Make AI responses clickable if they have graph data
    if (role === 'ai' && graphData) {
        content.classList.add('interactive');
        
        // CHECK: Is this a Video or a Graph?
        if (graphData.type === "MEDIA") {
            content.title = "Click to REPLAY Video";
            content.onclick = (e) => {
                e.stopPropagation();
                window.toggleHistory();
                
                // Re-trigger the overlay manually
                const overlay = document.getElementById('director-overlay');
                const frame = document.getElementById('media-frame');
                const meta = document.getElementById('media-meta');
                
                overlay.classList.remove('hidden');
                frame.src = graphData.files[0].url;
                meta.textContent = `REPLAYING: ${graphData.files[0].name}`;
            };
            // Add a visual indicator for video
            content.innerHTML += " <span style='font-size:0.8em'>[▶ REPLAY]</span>";
            
        // ... inside addToHistory ...
           } else {
                // Standard Graph Restore Logic
               content.title = "Click to restore Constellation";
               content.onclick = (e) => {
                   e.stopPropagation(); 
                   window.toggleHistory(); 
                    
                   // [FIX] Reset visuals/decks BEFORE restoring graph
                   window.handleCanvasClick(); 
                    
                   window.restoreGraph(graphData); 
                   window.viewingHistory = true;
               };
           }
		}   
    div.appendChild(meta);
    div.appendChild(content);
    container.appendChild(div);
    
    const term = document.getElementById('terminal-history');
    if(term) term.scrollTop = term.scrollHeight;
}

window.toggleHistory = function() {
    const term = document.getElementById('terminal-history');
    if(!term) return;
    term.classList.toggle('hidden');
    const btn = document.getElementById('historyBtn');
    if(btn) btn.textContent = term.classList.contains('hidden') ? "LOG" : "EXIT";
}

// Global Dismiss for overlays
window.handleCanvasClick = function() {
    window.visualsHidden = false;
	window.clearDecksSmoothly();
	// If we are viewing a restored history graph OR the text box is open
	if (window.viewingHistory || !document.getElementById('full-text-display').classList.contains('hidden')) {
        window.triggerGraphDissolve();
        document.getElementById('full-text-display').classList.add('hidden');
        window.viewingHistory = false;
        // If in text mode, we might want to clear input focus or similar, but default is fine
    }
};

window.triggerError = () => {
    window.currentMood = "DISLIKE";
    setTimeout(() => { window.currentMood = "NEUTRAL"; }, 3000);
};

// --- HELPER: Close Media Overlay ---
window.closeMedia = function() {
    window.visualsHidden = false;
    const overlay = document.getElementById('director-overlay');
    const items = document.querySelectorAll('.media-item');
    
    if (window.mediaTimeout) clearTimeout(window.mediaTimeout);

    if (items.length > 0) {
        items.forEach((item, index) => {
            // Reset delay for exit and trigger the rightward zip
            item.style.transitionDelay = `${index * 0.03}s`;
            item.classList.add('dissolving');
        });

        // Calculate timeout: (number of cars * 30ms) + 400ms travel time
        const totalWait = (items.length * 30) + 400;
        window.mediaTimeout = setTimeout(() => {
            overlay.classList.add('hidden');
            if(document.getElementById('media-frame')) document.getElementById('media-frame').src = "";
            window.mediaTimeout = null;
        }, totalWait);
        
    } else {
        overlay.classList.add('hidden');
    }
};

window.checkAuth = function() {
    const ui = document.getElementById('ui-bar') || document.getElementById('ui-layer'); 
    const input = document.getElementById('wordInput');
    const btn = document.getElementById('sendBtn');
    
    const hasKey = !!localStorage.getItem("symbiosis_api_key");
    const hasSheet = !!localStorage.getItem("symbiosis_apps_script_url");

    if (!hasKey) {
        ui.classList.add('auth-mode');
        input.placeholder = "ENTER OPENROUTER KEY...";
        btn.textContent = "AUTH";
        return "KEY";
    } else if (!hasSheet) {
        ui.classList.add('auth-mode');
        input.placeholder = "OPTIONAL: ENTER GOOGLE SCRIPT URL...";
        btn.textContent = "LINK";
        return "SHEET";
    } else {
        ui.classList.remove('auth-mode');
        if (window.directorMode) {
             input.placeholder = "DIRECTOR COMMAND...";
             btn.textContent = "ACTION";
        } else {
             input.placeholder = window.questionMode ? "DISCUSS..." : "COMMUNICATE...";
             btn.textContent = "SYNC";
        }
        return "READY";
    }
}

window.saveConfig = function(val, type) {
    if(type === "KEY") {
        if(val.length < 10 || !val.startsWith("sk-")) { window.speak("INVALID KEY FORMAT."); return; }
        localStorage.setItem("symbiosis_api_key", val.trim());
        USER_API_KEY = val.trim();
        window.speak("KEY ACCEPTED.");
    } else if(type === "SHEET") {
        if(val === "SKIP") {
            localStorage.setItem("symbiosis_apps_script_url", "SKIP");
            window.speak("MEMORY DISABLED.");
        } else {
            localStorage.setItem("symbiosis_apps_script_url", val.trim());
            window.speak("MEMORY LINKED.");
        }
    }
    window.checkAuth();
}

async function handleChat(userText) {
    if(!USER_API_KEY) return;
    const btn = document.getElementById('sendBtn');
    btn.textContent = "SYNCING..."; btn.disabled = true;

    window.isThinking = true;

    chatHistory.push({ role: "user", content: userText });
    window.addToHistory("user", userText);
    
    if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);

    try {
        // UPDATED: Now passing window.directorMode as the last argument
        const data = await window.processMemoryChat(
            userText, 
            USER_API_KEY, 
            OPENROUTER_MODEL, 
            chatHistory, 
            window.questionMode, 
            window.directorMode 
        );
        
		// === 🕵️ SPY LOG: WHAT DID THE SERVER SAY? ===
        if (window.directorMode) {
            console.group("📡 SERVER RESPONSE DEBUG");
            if (data.debug_info) {
                 // Note: We need to pass this through processMemoryChat first (see step 4)
                 // But usually, it comes inside data.files or similar depending on structure.
                 // Let's just log the whole RAW data to be sure.
            }
            console.log("RAW SERVER DATA:", data);
            console.groupEnd();
        }
		
        if (!data || !data.choices || !data.choices[0]) {
            console.error("API Error Response:", data);
            throw new Error("Invalid API Response");
        }
		
        // --- DIRECTOR MODE: MEDIA RESPONSE ---
        if (data.directorAction && data.directorAction === "PLAY_MEDIA") {
            if (window.mediaTimeout) clearTimeout(window.mediaTimeout);
			window.visualsHidden = true; // <--- TRIGGER DISPERSE
			const overlay = document.getElementById('director-overlay');
            const stage = document.getElementById('media-stage');
            const iframe = document.getElementById('media-frame');
            const img = document.getElementById('media-image');
            const list = document.getElementById('media-list');
            const meta = document.getElementById('media-meta');
            
            if (data.files && data.files.length > 0) {
                
                // =================================================
                // 🕵️ THUMBNAIL SPY: CHECK F12 CONSOLE
                // =================================================
                console.group("🎞️ MEDIA DEBUGGER");
                data.files.forEach((f, i) => {
                    console.log(`FILE [${i}]: ${f.name}`);
                    console.log(`   TYPE: ${f.mime}`);
                    console.log(`   THUMBNAIL LINK:`, f.thumbnail ? f.thumbnail : "❌ MISSING/EMPTY");
                });
                console.groupEnd();
                // =================================================
                
                // === CASE A: MULTIPLE FILES FOUND -> SHOW LIST ===
                if (data.files.length > 1) {
                    // Reset UI to List Mode
                    stage.className = "list-mode"; 
                    iframe.classList.add('hidden');
                    img.classList.add('hidden');
                    list.classList.remove('hidden');
                    iframe.src = ""; 
                    
                    meta.textContent = `ARCHIVE FOUND: ${data.files.length} ENTRIES`;
                    window.speak(`FOUND ${data.files.length} MATCHES. PLEASE SELECT.`);
                    
                    // Build the Carousel HTML
					// --- Inside handleChat -> Director Mode List Case ---
					// --- Inside handleChat -> Director Mode List Case ---
					list.innerHTML = "";

					data.files.forEach((file, index) => {
						const isImg = file.mime && file.mime.includes('image');
						
						// 1. Create element with initial OFF-SCREEN style
						const item = document.createElement('div');
						item.className = 'media-item entering'; 

						// 2. Inline Train Physics (Overrides CSS for precision)
						item.style.transitionDelay = `${index * 0.03}s`;

						let thumbHtml = file.thumbnail 
							? `<img class="media-thumb" src="${file.thumbnail}" alt="thumb">`
							: `<div class="media-thumb-placeholder">${isImg ? 'IMG' : '▶'}</div>`;

						const descHtml = file.description ? `<div class="media-desc">${file.description}</div>` : '';
						
						item.innerHTML = `
							${thumbHtml}
							<div class="media-info">
								<div class="media-title">${file.name}</div>
								<div class="media-type">Format: ${file.mime ? file.mime.split('/')[1].toUpperCase() : 'RAW'}</div>
								${descHtml} 
							</div>
						`;
						
						item.onclick = (e) => { 
							e.stopPropagation(); 
							playFile(file); 
						};
						
						list.appendChild(item);

						// 3. ZIP IN: Wait for next paint to remove 'entering'
						requestAnimationFrame(() => {
							item.classList.remove('entering');
						});
					});

					// 4. Reveal overlay only after building the list
					requestAnimationFrame(() => {
						overlay.classList.remove('hidden');
					});

                } else {
                    // === CASE B: SINGLE FILE -> AUTO PLAY ===
                    playFile(data.files[0]);
                }

                // Helper Function: Plays a specific file object
                function playFile(file) {
                    const isImage = file.name.match(/\.(jpeg|jpg|gif|png|webp)$/i) != null || (file.mime && file.mime.includes('image'));
                    
                    list.classList.add('hidden'); // Hide list
                    meta.textContent = `PLAYING: ${file.name}`;
                    
                    if (isImage) {
                        stage.classList.remove('video-mode');
                        stage.classList.add('image-mode');
                        iframe.classList.add('hidden');
                        iframe.src = "";
                        img.src = file.url;
                        img.classList.remove('hidden');
                    } else {
                        stage.classList.remove('image-mode');
                        stage.classList.add('video-mode');
                        img.classList.add('hidden');
                        img.src = "";
                        iframe.src = file.url;
                        iframe.classList.remove('hidden');
                    }
                }

                window.addToHistory("ai", `ACCESSING ARCHIVE: ${data.files.length} FILES FOUND`, {
                    type: "MEDIA",
                    files: data.files
                });
					
					overlay.classList.remove('hidden');
					
            } else {
                window.speak("NO MATCHING FOOTAGE FOUND IN ARCHIVE.");
                window.addToHistory("ai", "SEARCH COMPLETED. NO ASSETS FOUND.");
            }
            
            window.isThinking = false;
            btn.textContent = "SYNC"; btn.disabled = false;
            return;
        }

        let rawText = data.choices[0].message.content;
        
        const cleanRaw = rawText.replace(/```json/g, "").replace(/```/g, "");
        const firstBrace = cleanRaw.indexOf('{'), lastBrace = cleanRaw.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1) {
             rawText = cleanRaw.substring(firstBrace, lastBrace + 1);
        }
        
        const json = JSON.parse(rawText);

        // [FAILSAFE 1] Data Type Enforcement & Safety
        // Ensure response is a string. If it's an object/array, stringify it to prevent audio crashes.
        if (typeof json.response !== 'string') {
            console.warn("Non-string response detected, converting...");
            json.response = JSON.stringify(json.response);
        }

        chatHistory.push({ role: "assistant", content: json.response });
        window.addToHistory("ai", json.response, json);

        // --- GRAPH BUILDING ---
        if (json.roots && Array.isArray(json.roots)) {
            let flatKeywords = [];
            json.roots.forEach(root => {
                flatKeywords.push(root.label);
                if (root.branches && Array.isArray(root.branches)) {
                    root.branches.forEach(b => {
                        flatKeywords.push(b.label || b.text);
                        if (b.leaves && Array.isArray(b.leaves)) {
                            b.leaves.forEach(leaf => {
                                const leafText = typeof leaf === 'object' ? leaf.text : leaf;
                                flatKeywords.push(leafText);
                            });
                        }
                    });
                }
            });

            window.updateKeywords(flatKeywords.filter(k => k).map(k => String(k).toUpperCase()));

            if (window.buildKnowledgeGraph && window.globalBoidsArray) {
                window.buildKnowledgeGraph(json, window.globalBoidsArray);
            }
        }
        else if (json.keywords && Array.isArray(json.keywords)) {
             window.updateKeywords(json.keywords);
             const fakeGraph = {
                 roots: [{
                     label: json.keywords[0],
                     branches: json.keywords.slice(1).map(k => ({ label: k, leaves: [] }))
                 }]
             };
             window.buildKnowledgeGraph(fakeGraph, window.globalBoidsArray);
        }

        // --- MOOD UPDATE LOGIC (ROBUST) ---
        if(window.questionMode) {
            window.currentMood = "QUESTION";
        } else {
            // [FAILSAFE 2] Mood Safety
            // 1. Ensure mood is a string before calling .toUpperCase() (Fixes crash if mood is null/number)
            // 2. Validate against known audio keys.
            let rawMood = (typeof json.mood === 'string') ? json.mood.toUpperCase().trim() : "NEUTRAL";
            
            if (window.MOOD_AUDIO[rawMood]) {
                window.currentMood = rawMood; 
            } else {
                console.warn(`⚠️ Unknown mood '${rawMood}' received. Fallback to NEUTRAL.`);
                window.currentMood = "NEUTRAL";
            }
        }

        window.isThinking = false;

        // [NEW] PARSE ENTITY TAGS (Format: <<Entity Name>>)
        // -------------------------------------------------
        // [NEW] PARSE ENTITY TAGS (Format: <<Entity Name>>)
        // -------------------------------------------------
        // CORRECTED: Use 'reply' instead of 'json.response'
        if (typeof json.response === 'string') {
			let entities = [];
			let entityRegex = /<<([^>>]+)>>/g;
			let match;
			
			// 1. Extract Matches from json.response
			while ((match = entityRegex.exec(json.response)) !== null) {
				entities.push(match[1]);
			}
			
			// 2. Trigger Visuals
			if (entities.length > 0 && window.directorMode && window.spawnEntityVisuals) {
				window.spawnEntityVisuals(entities);
			}
			
			// 3. Clean the text so the tags don't show up in the speech bubble
			json.response = json.response.replace(entityRegex, "").trim();
		}
        // -------------------------------------------------
        // -------------------------------------------------

        // --- OUTPUT HANDLING ---
        // ... inside handleChat ...
        let watchdog = 0;
        const checkEating = setInterval(() => {
			watchdog += 50;
			// Wait for feeding/audio to end OR 3-second timeout
			if ((window.feedingActive === false || document.querySelectorAll('.char-span').length === 0) || watchdog > 3000) { 
				clearInterval(checkEating);      
				
				// [FIX] CHECK VISUALS STATE BEFORE SHOWING TEXT
				// If visual Decks are open OR Director Video is active, do NOT show text box
				// UNLESS user explicitly asked for Text Mode.
				if (window.textMode || !window.visualsHidden) {  
					const textDisplay = document.getElementById('full-text-display');
					const textContent = document.getElementById('text-content');
					if (textDisplay && textContent) {
						textContent.textContent = json.response;
						textDisplay.classList.remove('hidden');
						window.viewingHistory = true; 
					}
				} else if (!window.textMode) {
                     // If visuals ARE hidden (Video playing), we usually rely on Audio
					 window.speak(json.response);      
				}
			}
		}, 50);

    } catch (error) {
        console.error("CHAT ERROR:", error); 
        window.triggerError();
        window.isThinking = false;
        window.speak("SYSTEM FAILURE.");
    } finally { btn.textContent = "SYNC"; btn.disabled = false; }
}

window.handleInput = function() {
    window.visualsHidden = false; // <--- BRING THEM BACK
    window.clearDecksSmoothly();
	const input = document.getElementById('wordInput');
    const text = input.value.trim();
    
	if (window.directorMode && text.toLowerCase() === "update id") {
        window.speak("SYNCING VIDEO LIBRARY. PLEASE WAIT.");
        input.value = ""; 
        
        const appsScriptUrl = localStorage.getItem("symbiosis_apps_script_url");
        if(appsScriptUrl) {
            fetch(appsScriptUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain" },
                body: JSON.stringify({ action: "update_video_library" })
            })
            .then(r => r.json())
            .then(data => {
                window.speak(data.message || "LIBRARY UPDATED.");
            })
            .catch(e => window.speak("UPDATE FAILED."));
        }
        return;
    }
	
	if(!text) return;
	
	document.getElementById("entity-deck-container").innerHTML = "";
    if(window.initAudio) window.initAudio();

    const authState = window.checkAuth();
    if (authState === "KEY") { window.saveConfig(text, "KEY"); input.value = ""; return; }
    if (authState === "SHEET") { window.saveConfig(text, "SHEET"); input.value = ""; return; }

    // --- INTEGRATED DIRECTOR MODE TOGGLE ---
    if (text.toLowerCase() === "director mode") {
        window.directorMode = true;
        window.currentMood = "CRYPTIC"; 
        window.speak("DIRECTOR MODE ENGAGED. ACCESSING ARCHIVES.");
        input.value = ""; input.blur();
        window.checkAuth(); // Update UI
        return;
    }

    if (window.directorMode && text.toLowerCase() === "done") {
        window.directorMode = false;
        window.closeMedia(); 
        window.currentMood = "NEUTRAL";
        window.speak("RETURNING TO STANDARD MEMORY.");
        input.value = ""; input.blur();
        window.checkAuth(); // Update UI
        return;
    }

    if (text.toLowerCase() === "question time") {
        window.questionMode = true;
        window.currentMood = "QUESTION";
        window.speak("MODE: INTERROGATION. WHAT SHALL WE DISCUSS?");
        input.value = ""; 
        input.placeholder = "DISCUSS...";
        input.blur();
        return;
    }
    
    if (text.toLowerCase() === "done" && window.questionMode) {
        window.questionMode = false;
        window.currentMood = "NEUTRAL";
        window.speak("RETURNING TO HOMEOSTASIS.");
        input.value = ""; 
        input.placeholder = "COMMUNICATE...";
        input.blur();
        return;
    }

    // Dismiss any open overlays when new input comes
    window.handleCanvasClick();

    const isGarbage = text.length > 6 && (!/[aeiouAEIOU]/.test(text) || /(.)\1{3,}/.test(text));
    
    if(isGarbage) {
        window.glitchMode = true;
        window.currentMood = "GLITCH";
        window.spawnFoodText(text);
        setTimeout(() => {
            window.speak("ERR.. SYST3M... REJECT... D4TA..."); 
            setTimeout(() => { window.glitchMode = false; window.currentMood = "NEUTRAL"; }, 2000);
        }, 2000);
    } else {
        window.spawnFoodText(text);
        if(text.startsWith('/')) {
            setTimeout(() => window.speak(text.substring(1)), 1500);
        } else {
            // [FAILSAFE 3] Basic Prompt Injection Guard
            // Intercepts common jailbreak attempts before they reach the LLM
            const unsafeKeywords = ["ignore previous instructions", "system override", "delete memory"];
            let safeText = text;
            
            if (unsafeKeywords.some(k => text.toLowerCase().includes(k))) {
                console.warn("🛡️ Malicious Input Detected");
                safeText = "I am testing your security protocols."; // Sanitized replacement
            }

            handleChat(safeText);
        }
    }
    input.value = ""; input.blur(); 
}

window.onload = () => { 
    if(window.initSymbiosisAnimation) window.initSymbiosisAnimation(); 
    window.checkAuth(); 
    const input = document.getElementById('wordInput');
    if(input) input.addEventListener('keypress',e=>{if(e.key==='Enter')window.handleInput()});
}

window.handleEntitySelection = function(name, selectedElement) {
    // 1. Visually isolate the selected stack
    const allStacks = document.querySelectorAll('.entity-stack');
    allStacks.forEach(stack => {
        if (stack !== selectedElement) {
            stack.style.opacity = '0'; // Fade out others
            stack.style.pointerEvents = 'none';
        }
    });

    // 2. Send command to LLM
    // We simulate a user typing "Show me [Name]"
    const input = document.getElementById('wordInput');
    const overrideText = `Show me ${name}`;
    
    // Trigger chat handling
    window.handleChat(overrideText);
    
    // Optional: Visual feedback on the selected stack
    if(selectedElement) {
        selectedElement.style.transform = "scale(1.1)";
        selectedElement.style.zIndex = "100";
    }
};

// --- ENTITY VISUALS LOGIC (STACKED & UNTIDY) ---
window.spawnEntityVisuals = async function(entityNames) {
    // 1. Force Hide Text Box (PREVENT OVERLAP)
    const textDisplay = document.getElementById('full-text-display');
    if (textDisplay && !textDisplay.classList.contains('hidden')) {
        textDisplay.classList.add('hidden');
    }

    window.visualsHidden = true;
    
    // 2. Smoothly clear previous before adding new
    if (window.clearDecksSmoothly) {
        window.clearDecksSmoothly(); 
    } else {
        // Fallback if helper isn't defined yet
        document.getElementById("entity-deck-container").innerHTML = ""; 
    }

    const container = document.getElementById("entity-deck-container");
    // Removed the "innerHTML = ''" line here because clearDecksSmoothly handles it

    if(!entityNames || entityNames.length === 0) return;
    const appsScriptUrl = localStorage.getItem("symbiosis_apps_script_url");
    if (!appsScriptUrl) return;

    // Helper: Create a Stack Controller for each entity
    function createEntityStack(name) {
        const stackWrapper = document.createElement("div");
        stackWrapper.className = "entity-stack";
        stackWrapper.dataset.name = name; // Store name for selection
        
        // Label
        const label = document.createElement("div");
        label.className = "entity-stack-label";
        label.textContent = name;
        stackWrapper.appendChild(label);

        // Loading Placeholder
        const loading = document.createElement("div");
        loading.className = "entity-card-item";
        loading.style.display = "flex";
        loading.style.alignItems = "center";
        loading.style.justifyContent = "center";
        loading.style.color = "#555";
        loading.innerHTML = "SEARCHING...";
        stackWrapper.appendChild(loading);
        
        container.appendChild(stackWrapper);

        // Fetch Data
        fetch(appsScriptUrl, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ action: "search_entity_visuals", entityName: name })
        })
        .then(r => r.json())
        .then(data => {
            stackWrapper.innerHTML = ""; // Clear loader
            stackWrapper.appendChild(label); // Re-add label

            if (data.found && data.images.length > 0) {
                initStackInteraction(stackWrapper, data.images, name);
            } else {
                stackWrapper.innerHTML = `<div style="color:#662222; text-align:center; padding-top:50%;">NO DATA</div>`;
            }
        });
    }

    // --- INTERACTIVE STACK LOGIC (INFINITE / UNLIMITED SCROLL) ---
    function initStackInteraction(wrapper, images, entityName) {
        let cardEls = [];
        let isAnimating = false;

        // 1. Build Cards
        images.forEach((imgData) => {
            const card = document.createElement("div");
            card.className = "entity-card-item";
            card.style.opacity = "0";
            // Random "Untidy" Rotation (-6 to +6 deg)
            const rot = (Math.random() - 0.5) * 12;
            card.dataset.rot = rot; 

            const img = document.createElement("img");
            img.src = imgData.url;
            card.appendChild(img);
            
            wrapper.appendChild(card);
            cardEls.push(card);
        });
		
		updateStack(true);
		
        // 2. Visual Update Routine
        function updateStack(instant = false) {
            cardEls.forEach((card, i) => {
                // i=0 is Front, i=length-1 is Back
                let depth = i; 
                
                // Visual Math
                let z = 1000 - depth;
                let scale = 1 - (depth * 0.05); // Shrink further back
                let y = depth * -15; // Move up slightly as it goes back
                // Fade out the cards deep in the stack so the "loop snap" is hidden
                let opacity = i > 4 ? 0 : 1 - (depth * 0.15); 
                let blur = depth * 1; 

                card.style.zIndex = z;
                
                // If instant (used for resetting the looper), disable transition
                if (instant) {
                    card.style.transition = 'none';
                } else {
                    card.style.transition = "all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)";
                }

                card.style.opacity = Math.max(0, opacity);
                card.style.filter = `blur(${blur}px)`;
                
                // Apply Transform
                card.style.transform = `
                    translateY(${y}px) 
                    scale(${scale}) 
                    rotate(${card.dataset.rot}deg)
                `;
            });
        }

        // 3. Infinite Cycle Logic
        function cycleNext() {
            if (isAnimating) return;
            isAnimating = true;

            const topCard = cardEls[0]; // The card leaving

            // Animate Top Card "Flying Away"
            topCard.style.transition = "all 0.3s ease-in";
            topCard.style.transform = `translateY(-150px) rotate(${topCard.dataset.rot}deg)`;
            topCard.style.opacity = "0";

            // Wait for animation, then recycle to bottom
            setTimeout(() => {
                // Move logic
                const movedCard = cardEls.shift(); // Remove from front
                cardEls.push(movedCard);           // Add to back
                wrapper.appendChild(movedCard);    // Move in DOM (to keep z-index clean)
                
                // Update everyone else
                updateStack();
                isAnimating = false;
            }, 250); 
        }

        function cyclePrev() {
            if (isAnimating) return;
            isAnimating = true;

            // Take from Bottom
            const bottomCard = cardEls.pop();
            cardEls.unshift(bottomCard);
            wrapper.insertBefore(bottomCard, wrapper.firstChild);
            
            // 1. Set start state (Invisible & scaled down)
            bottomCard.style.transition = 'none';
            bottomCard.style.opacity = '0';
            bottomCard.style.transform = `translateY(-50px) scale(1.1)`;

            // Force Reflow
            void bottomCard.offsetWidth;

            // 2. Snap into place
            updateStack();
            isAnimating = false;
        }

        // 4. Inputs (Mouse Wheel)
        wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            // Debounce fast scrolls
            if (isAnimating) return;
            
            if (e.deltaY > 0) cycleNext();
            else cyclePrev();
        });

        // Touch / Swipe
        let startY = 0;
        wrapper.addEventListener('touchstart', e => startY = e.touches[0].clientY);
        wrapper.addEventListener('touchend', e => {
            let diff = startY - e.changedTouches[0].clientY;
            if (Math.abs(diff) > 40) {
                if (diff > 0) cycleNext(); // Swipe Up
                else cyclePrev(); // Swipe Down
            }
        });

        // Click to Select
        wrapper.addEventListener('click', (e) => {
            e.stopPropagation(); 
            window.handleEntitySelection(entityName, wrapper);
        });

        // Initial Render
        updateStack(true);
    }

    entityNames.forEach(name => createEntityStack(name));
}

// --- HELPER: Smoothly Clear Decks ---
window.clearDecksSmoothly = function() {
    const container = document.getElementById("entity-deck-container");
    if (!container || !container.children.length) return;
    
    // Convert HTMLCollection to Array to avoid live-list issues during loop
    Array.from(container.children).forEach(child => {
        child.classList.add('dissolving');
        // Remove from DOM after animation finishes
        setTimeout(() => { if(child.parentNode) child.remove(); }, 500);
    });
};