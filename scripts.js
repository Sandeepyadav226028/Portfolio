// Formspree endpoint updated with your URL
const FORMSPREE_ENDPOINT = 'https://formspree.io/f/mldpnjad'; 

// Utility function for exponential backoff during API calls
async function fetchWithBackoff(url, options, maxRetries = 5) {
    let delay = 1000;
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return response;
            }
            // For non-network errors (e.g., 429 or 403), retry
            console.warn(`Attempt ${i + 1} failed with status ${response.status}. Retrying...`);
        } catch (error) {
            // Network errors
            console.warn(`Attempt ${i + 1} failed with error: ${error.message}. Retrying...`);
        }
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
    }
    throw new Error("Failed to fetch from API after multiple retries.");
}

async function refineMessage() {
    const messageTextarea = document.getElementById('message');
    const projectTypeSelect = document.getElementById('project_type');
    const refinementContainer = document.getElementById('refinement-container');
    const refinementOutput = document.getElementById('refinement-output');
    const refinementLoading = document.getElementById('refinement-loading');
    const refinementError = document.getElementById('refinement-error');
    const refineButton = document.getElementById('refine-button');

    const message = messageTextarea.value.trim();
    const projectType = projectTypeSelect.value;

    refinementContainer.classList.add('hidden');
    refinementError.classList.add('hidden');
    refinementOutput.textContent = '';

    // Simple validation
    if (message.length < 20) {
        refinementError.textContent = 'Please write a slightly longer message (at least 20 characters) before refining.';
        refinementError.classList.remove('hidden');
        return;
    }
    if (!projectType) {
        refinementError.textContent = 'Please select a Project Type for better refinement context.';
        refinementError.classList.remove('hidden');
        return;
    }

    refineButton.disabled = true;
    refinementLoading.classList.remove('hidden');

    // --- Gemini API Call Setup ---
    const systemPrompt = "You are a professional communication expert. Your task is to take a draft message from a potential client/recruiter to a web developer and refine it to be more professional, clear, and compelling. Ensure the tone is respectful and concise. Do NOT add salutations (like 'Hello Sandeep') or sign-offs (like 'Sincerely'). Return ONLY the refined message text, maintaining paragraph breaks if present.";
    
    const userQuery = `Refine the following message for an inquiry categorized as "${projectType}". Original message: "${message}"`;

    // FIX: Using conditional URL construction. 
    // Default to the simplest URL, but if a global __api_key is available, use it explicitly.
    let apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent`;
    
    // Check for global key and add it explicitly if found. This helps resolve 403 issues 
    // when implicit authentication fails.
    if (typeof __api_key !== 'undefined' && __api_key) {
        apiUrl += `?key=${__api_key}`;
    }

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: {
            parts: [{ text: systemPrompt }]
        },
    };

    try {
        const response = await fetchWithBackoff(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        const refinedText = result.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (refinedText) {
            refinementOutput.textContent = refinedText;
            refinementContainer.classList.remove('hidden');
        } else {
            refinementError.textContent = 'Refinement failed: Could not generate a suggestion.';
            refinementError.classList.remove('hidden');
            console.error('Gemini API Response Error:', result);
        }

    } catch (error) {
        refinementError.textContent = 'API call failed. Please check your network connection.';
        refinementError.classList.remove('hidden');
        console.error('Gemini API Network/Retry Error:', error);
    } finally {
        refineButton.disabled = false;
        refinementLoading.classList.add('hidden');
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('contact-form');
    const formMessage = document.getElementById('form-message');
    const submitButton = document.getElementById('submit-button');


    // --- CONTACT FORM LOGIC (RELIABLE FETCH) ---
    if (!form || !formMessage || !submitButton) {
        console.error("Contact form elements not found.");
        return;
    }

    form.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // Disable button and show loading state
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
        formMessage.textContent = 'Sending message...';
        formMessage.classList.remove('hidden', 'text-green-400', 'text-red-400');
        formMessage.classList.add('block', 'text-light-text');

        const data = new FormData(event.target); 

        try {
            const response = await fetch(FORMSPREE_ENDPOINT, {
                method: 'POST',
                body: data, 
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                formMessage.textContent = 'Message sent successfully! I will be in touch soon.';
                formMessage.classList.remove('text-light-text', 'text-red-400');
                formMessage.classList.add('text-green-400');
                form.reset(); // Only reset on success
            } else {
                // Keep input data on failure, but show error
                formMessage.textContent = 'Error: Failed to send message. Please try again or check the console.';
                formMessage.classList.remove('text-light-text');
                formMessage.classList.add('text-red-400');
            }
        } catch (error) {
            console.error('Network Error:', error);
            formMessage.textContent = 'A network error occurred. Please try again.';
            formMessage.classList.remove('text-light-text');
            formMessage.classList.add('text-red-400');
        } finally {
            // Restore button after response (whether success or fail)
            submitButton.disabled = false;
            submitButton.textContent = 'Send Message';
        }
    });

    // --- LLM Feature Event Listeners ---
    const refineButton = document.getElementById('refine-button');
    const applyRefinementButton = document.getElementById('apply-refinement-button');
    const messageTextarea = document.getElementById('message');

    if (refineButton && applyRefinementButton && messageTextarea) {
        refineButton.addEventListener('click', refineMessage);
        
        applyRefinementButton.addEventListener('click', () => {
            const refinedText = document.getElementById('refinement-output').textContent;
            messageTextarea.value = refinedText;
            document.getElementById('refinement-container').classList.add('hidden');
        });
    } else {
        console.warn("Refinement elements not found. LLM feature initialization skipped.");
    }
});
