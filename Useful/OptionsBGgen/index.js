/**
 * @typedef {Element | string} Child
 */

/**
 * @typedef {Promise<T> | T} PromiseMaybe
 * @template {any} T
 */

/**
 * @typedef {Object} GithubFileInfo
 * @property {string} name The filename of the file (includes any file extension)
 * @property {string} path The path to the file, within the repository branch (includes the filename)
 * @property {string} sha
 * @property {number} size The size of the file in bytes
 * @property {string} url The API endpoint to access the contents of the file
 * @property {string} html_url The URL that points to the file in GitHub's frontend
 * @property {string} git_url The API endpoint to access the file's contents as a Git blob
 * @property {string} download_url The raw.githubusercontent.com URL to directly download the file from
 * @property {"file" | "dir" | "symlink" | "submodule"} type Tells you if this file-like object is a file, directory, or something else
 */

/**
 * @typedef {Object} SafeFetchOptions
 * @property {string} [loadingText]
 * @property {string} [failText]
 * @property {(error: unknown) => void} [onFail]
 * @property {Omit<ErrorOptions, "message">} [error]
 * @property {boolean} [showError] Set to `true` if a failure would be important enough to display to the user
 * @property {boolean} [disableForm] Set to `true` if a failure would prevent the app from continuing to function
 */

/**
 * Wrapper for `fetch()` with loading messages and error handling built-in
 * @param {string} url
 * @param {RequestInit} [request]
 * @param {SafeFetchOptions} [options]
 */
async function safeFetch(url, options = {}, request) {
    const parsedUrl = new URL(url);
    const {
        loadingText,
        failText = `Failed to fetch ${parsedUrl.hostname}`,
        onFail,
        showError: shouldShowError = true,
        disableForm: shouldDisableForm = true,
        error,
    } = options;

    const filename = parsedUrl.pathname.split("/").pop();
    const errorOptions = {
        // This should prevent the same request creating multiple errors:
        id: parsedUrl.origin + parsedUrl.pathname + parsedUrl.search,
        extras: [`(${filename || parsedUrl})`],
        ...options.error,
    };

    const disabledForm = loadingText && disableForm?.(loadingText);
    try {
        const response = await fetch(url.toString(), request);
        if (!response.ok) throw `${response.status} ${response.statusText}`;
        disabledForm?.removePlaceholder();
        return response;
    } catch (error) {
        shouldDisableForm
            ? disableForm?.(failText)
            : disabledForm.removePlaceholder();
        if (shouldShowError) {
            let message = `HTTP request failed (${parsedUrl})`;
            if (error instanceof Error) message = error.message;
            if (typeof error === "string") message = error;
            showError({ ...errorOptions, message });
        }
        onFail?.(error);
        throw error;
    }
}

/**
 * A utility for asynchronously fetching JSON data
 * @param {string} url
 * @param {RequestInit} [request]
 * @param {object} [options]
 */
function fetchJSON(url, options, request) {
    /** @type {RequestInit} */
    const requestInit = {
        headers: {
            ...request?.headers,
            Accept: "application/json",
        },
        ...request,
    };

    return safeFetch(url, options, requestInit).then((res) => res.json());
}

/**
 * Removes the file extension from a filename
 * @param {string} filename
 * @returns The basename of the provided file
 */
function removeExtension(filename) {
    return filename.replace(/^(.*)\.(\w+)$/, "$1");
}

/**
 * Utility function that uses the CORS Everywhere service to access a URL without CORS errors
 * @param {string} url
 * @deprecated CORS Everywhere service is currently non-functional
 */
function corsEverywhere(url) {
    return "https://rocky-castle-55647.herokuapp.com/" + url;
}

/**
 * @typedef {Object} RemoteControlData
 * @property {boolean} run
 * @property {string} downMsg
 * @property {Date} commitTimestamp
 * @property {string} commitAuthor
 */

/**
 * Fetches the data from the remote control gist: https://gist.github.com/MMK21Hub/bbd7afbc74eb582c1a9d78b031b24f94
 * @returns {Promise<RemoteControlData>}
 */
async function getRemoteControl() {
    const requestOptions = { showError: false };
    const commitList = await fetchJSON(Endpoints.RC_COMMITS, requestOptions);
    const latestCommit = await fetchJSON(commitList[0].url, requestOptions);
    const rawContent = latestCommit.files["remoteControl.json"].content;
    const result = JSON.parse(rawContent);

    result.commitTimestamp = new Date(latestCommit.updated_at);
    result.commitAuthor = latestCommit.owner.login;
    return result;
}

/**
 * Gets the data of a block texture file from the vanilla resourcepack. Uses the mcmeta repository.
 * @param {string} name The filename of the texture to fetch (within assets/minecraft/textures/block)
 */
async function fetchTextureFileData(name) {
    const matchingFile = textureFileList.find((f) => f.name === name);
    if (!matchingFile)
        throw new Error(`Couldn't find a texture with the filename ${name}`);

    const url = matchingFile.download_url;

    const fileContent = await safeFetch(
        url,
        {
            disableForm: false,
            loadingText: "Downloading texture...",
            error: {
                tags: ["fetch-texture"],
                category: "Downloading texture",
            },
        },
        {
            headers: {
                Accept: "image/png",
            },
        }
    ).then((res) => res.arrayBuffer());

    return fileContent;
}

/**
 * Replaces the page's contents with a notice indicating that the site is disabled
 * @param {RemoteControlData} [data] The information to include in the notice
 */
function showSiteDisabledNote(data) {
    /** `true` is the site has been disabled by the user, i.e. with a URL param */
    const manuallyDisabled = !data;

    const message = !manuallyDisabled
        ? "The Options Background Generator has been disabled remotely. Check back later?"
        : `Remove the "disabled" URL parameter to use this page.`;
    const siteDisabledWrapper = div(
        "#site-disabled-wrapper",
        p("#site-disabled-note", message)
    );
    document.body.replaceWith(siteDisabledWrapper);

    if (manuallyDisabled) return;
    const { downMsg, commitTimestamp, commitAuthor } = data;

    if (downMsg) {
        siteDisabledWrapper.append(
            p("#site-disabled-message", [
                `Message provided by ${commitAuthor}: `,
                em(downMsg),
            ])
        );
    }

    if (commitTimestamp) {
        siteDisabledWrapper.append(
            p(
                "#site-disabled-timestamp",
                `Remote control last updated ${commitTimestamp.toLocaleString()}`
            )
        );
    }
}

/**
 *
 * @param {string} placeholder The text to show in the disabled selector
 * @param {object} options
 * @param {number} [options.delay] Wait for a specified number of milliseconds before disabling the selector. Used to prevent the flash of a disabled selector when the operation completes quickly.
 * @returns
 */
function disableForm(placeholder = "Loading...", options = {}) {
    const placeholderValue = "__placeholder__";

    // Grab relevant elements
    const selector = /** @type {HTMLButtonElement} */ ($("#texture-selector"));
    const button = /** @type {HTMLButtonElement} */ ($("#generate-pack"));

    // Store old state
    const oldValue = selector.value;

    // Keep track of the element being used as a placeholder option
    /** @type {HTMLOptionElement?} */
    let placeholderElement = null;

    setTimeout(() => {
        // Disable the form
        selector.disabled = true;
        button.disabled = true;

        // Set the placeholder
        placeholderElement = new Option(placeholder, placeholderValue);
        placeholderElement.dataset.formPlaceholder = "true";

        // Clean up any placeholder options that already exist
        const existingPlaceholders = selector.querySelectorAll(
            "option[data-form-placeholder]"
        );
        if (existingPlaceholders.length) {
            existingPlaceholders.forEach((element) => element.remove());
        }

        selector.append(placeholderElement);
        selector.value = placeholderValue;
    }, options.delay || 0);

    function removePlaceholder() {
        // Do nothing if the state change hasn't happened yet
        if (!placeholderElement) return;

        // Restore old state
        selector.value = oldValue;

        // Remove the placeholder option
        placeholderElement.remove();

        // Enable the form
        selector.disabled = false;
        button.disabled = false;
    }

    /**
     * @param {string} text
     */
    function updatePlaceholder(text) {
        if (placeholderElement) {
            placeholderElement.textContent = text;
            return;
        }

        // If the state change hasn't happened yet, just modify
        // the string that will be used as the placeholder text
        placeholder = text;
    }

    return {
        removePlaceholder,
        updatePlaceholder,
    };
}

/**
 * Corrects the state of the error list section.
 * If there aren't any errors, the section is hidden. Otherwise, it's shown.
 */
function updateErrorList() {
    const section = $("section#errors");
    const errorList = /** @type {HTMLUListElement} */ ($("#error-list"));
    const errors = errorList.childElementCount;

    section.hidden = !errors;
}

/** Returns an array of all the errors currently being shown */
function getErrors() {
    return Array.from(errorList.querySelectorAll("li"));
}

/**
 * @typedef {Object} ErrorOptions
 * @property {Child} [category]
 * @property {Child} message
 * @property {Child[]} [extras]
 * @property {string[]} [tags]
 * @property {string} [id]
 */

/**
 * @param {ErrorOptions} options
 */
function showError(options) {
    const { message, tags = [], id, category, extras = [] } = options;

    // Validate that tags don't have spaces
    const invalidTagIndex = tags.findIndex((tag) => tag.includes(" "));
    if (invalidTagIndex != -1) {
        throw new SyntaxError(`Tags can't contain spaces`);
    }

    // Deduplicate any errors with the same ID
    const duplicates = getErrors().filter((e) => e.dataset.id === id);
    duplicates.forEach((element) => element.remove());

    const element = li(
        {
            "data-tags": tags?.join(" "),
            "data-id": id || "",
        },
        [category && strong([category, ":"]), " ", message, " ", ...extras]
    );

    errorList.append(element);
    updateErrorList();
}

/**
 * @param {string} tag
 */
function removeErrors(tag) {
    const matches = getErrors().filter((error) => {
        const tags = error.dataset.tags?.split(" ");
        if (!tags) return;
        return tags.includes(tag);
    });

    matches.forEach((match) => match.remove());

    updateErrorList();
}

/**
 * @returns {Promise<boolean>} `true` if the remote control is allowing the site to run.
 */
async function checkRemoteControl() {
    const forceDisabled = urlParams.has("disabled");

    if (forceDisabled) {
        showSiteDisabledNote();
        return false;
    }

    // Remote control should still be checked during development, for testing purposes
    const isDev = ["localhost", "127.0.0.1"].includes(window.location.hostname);
    // Remote control should only apply to the official domain
    if (!isDev && window.location.host !== "mmk21hub.github.io") return true;

    try {
        const remoteControl = await getRemoteControl();
        if (remoteControl.run) return true;
        showSiteDisabledNote(remoteControl);
        return false;
    } catch (error) {
        console.warn("Failed to fetch remote control");
        // Assume that it's safe to run the app
        return true;
    }
}

async function loadSelectorContents() {
    const textureSelector = /** @type {HTMLSelectElement} */ (
        $("#texture-selector")
    );

    /** @type {GithubFileInfo[]} */
    const textureDirContents = await fetchJSON(
        Endpoints.MCMETA_BLOCK_TEXTURES,
        {
            loadingText: "Loading texture list...",
            failText: "Failed to fetch textures!",
            onFail() {
                $("#refresh-texture-list").removeAttribute("hidden");
            },
            error: {
                category: "Texture list",
                id: "load-selector-contents",
                tags: ["texture-list"],
            },
        }
    );

    const textureFiles = textureDirContents.filter((f) => f.type === "file");
    textureFileList = textureFiles;
    console.log(
        `Fetched data for ${textureFiles.length} textures from the mcmeta repository on GitHub`
    );

    textureFiles.forEach((textureFile) => {
        const displayName = removeExtension(textureFile.name);
        const option = new Option(displayName, textureFile.name);
        textureSelector.add(option);
    });

    // Select the stone texture by default
    Array.from(textureSelector.options).forEach((option) => {
        if (option.value === "stone.png") option.selected = true;
    });

    removeErrors("texture-list");
}

/**
 * Generates a minecraft resource pack metadata file
 * @param {string} texture The texture name used in the pack, e.g `spruce_planks`
 * @returns An object ready to be stringified and used as a pack.mcmeta
 */
function generatePackMetadata(texture) {
    return {
        pack: {
            description: `Uses the ${texture} texture as an options screen background`,
            pack_format: 14, // TODO: Make this an option
        },
    };
}

/**
 * @param {BlobPart} data The contents of the file, as a Buffer, Blob or string
 * @param {string} type MIME type of the file
 * @param {string} filename The user will be prompted to use this filename when downloading
 */
function promptForDownload(data, type, filename) {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);

    const link = a({
        download: filename,
        href: url,
    });

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

/** @param {Event} e */
async function generatePack(e) {
    if (!(e.target instanceof HTMLFormElement)) return;
    e.preventDefault();
    const formData = new FormData(e.target);
    const textureName = formData.get("selected-texture").toString();
    const textureFriendlyName = removeExtension(textureName);

    const textureData = await fetchTextureFileData(textureName);
    console.log(`Texture data for ${textureName}`, textureData);

    const metaFileData = JSON.stringify(
        generatePackMetadata(textureFriendlyName)
    );
    const files = [
        new File([metaFileData], "pack.mcmeta"),
        new File([textureData], "pack.png"),
        new File(
            [textureData],
            "assets/minecraft/textures/gui/options_background.png"
        ),
    ];

    // We've successfully fetched a texture, so remove any old errors
    removeErrors("fetch-texture");

    const { downloadZip } = await ClientZip;
    const zip = await downloadZip(files).arrayBuffer();
    promptForDownload(
        zip,
        "application/zip",
        `Options Background ${textureFriendlyName}`
    );
}

async function reloadTextureList() {
    try {
        await loadSelectorContents();
    } catch (error) {
        let message = "Couldn't load textures";
        if (error instanceof Error) message = error.message;
        if (typeof error === "string") message = error;

        showError({
            category: "Texture list",
            message,
            id: "load-selector-contents",
            tags: ["texture-list"],
        });

        console.error("Failed to reload texture list:", error);
    }
}

async function main() {
    // @ts-ignore
    ClientZip = import("https://unpkg.com/client-zip@2.3.1/index.js");

    await fetchHyperscript();

    const shouldRun = await checkRemoteControl();
    if (!shouldRun) return;

    const versionManifest = await fetchJSON(Endpoints.VERSION_MANIFEST);
    console.log("Latest MC version", versionManifest.latest.snapshot);

    loadSelectorContents();
    mainForm.addEventListener("submit", generatePack);
    $("#refresh-texture-list").addEventListener("click", reloadTextureList);
}

async function fetchHyperscript() {
    updatePlaceholder("Loading hyperscript...");
    const startTime = performance.now();
    // @ts-ignore
    hyperScript = await import("https://cdn.skypack.dev/hyperscript");
    updatePlaceholder("Loading hyperscript-helpers...");
    hyperScriptHelpers = await import(
        // @ts-ignore
        "https://cdn.skypack.dev/hyperscript-helpers"
    );

    // Put the placeholder back to "Loading..." because other tasks still need to be completed
    // This assumption works because fetchHyperscript() is only called once, in main()
    updatePlaceholder("Loading...");
    console.log(
        "Fetching hyperscript took (ms):",
        performance.now() - startTime
    );

    const hh = hyperScriptHelpers.default(hyperScript.default);
    // We have to manually cast the specific HTMLElement types for each element:
    p = /** @type {HyperScript<HTMLParagraphElement>} */ (hh.p);
    div = /** @type {HyperScript<HTMLDivElement>} */ (hh.div);
    em = /** @type {HyperScript<HTMLElement>} */ (hh.em);
    strong = /** @type {HyperScript<HTMLElement>} */ (hh.strong);
    li = /** @type {HyperScript<HTMLLIElement>} */ (hh.li);
    a = /** @type {HyperScript<HTMLAnchorElement>} */ (hh.a);
}

/**
 * Shorthand for {@link document.querySelector} (gets an element from the DOM using a CSS selector)
 * @param {string} selector A string representing a CSS selector
 * @returns {HTMLElement | null} The first Element within the document that matches the specified selector, or null if no matches are found
 */
const $ = (selector) => document.querySelector(selector);
/** Shorthand access to the current URL parameters */
const urlParams = new URLSearchParams(window.location.search);
/** An array of GitHub files for each available texture @type {GithubFileInfo[]} */
let textureFileList;

// EARLY LOADING STAGE
const { updatePlaceholder } = disableForm("Loading app resources...");

// Placeholders for dynamic imports
/** @type {PromiseMaybe<import("client-zip")>} */
let ClientZip;
/** @type {{default: import("hyperscript")}} */
let hyperScript;
/** @type {import("./hyperscript")} */
let hyperScriptHelpers;

/**
 * @typedef {import("./hyperscript").HyperScriptHelperFn<E, any, string | (string | Element)[]>} HyperScript<E>
 * @template {HTMLElement} E
 */

// A load of scaffolding to get correct types when using hyperscript-helpers:
/** @type {HyperScript<HTMLParagraphElement>} */
let p,
    /** @type {HyperScript<HTMLDivElement>} */
    div,
    /** @type {HyperScript<HTMLElement>} */
    em,
    /** @type {HyperScript<HTMLElement>} */
    strong,
    /** @type {HyperScript<HTMLLIElement>} */
    li,
    /** @type {HyperScript<HTMLAnchorElement>} */
    a;

/** @enum {string} */
const Endpoints = {
    /** A list of commits to the remote control gist. Used to get the latest revision and its metadata. */
    RC_COMMITS:
        "https://api.github.com/gists/bbd7afbc74eb582c1a9d78b031b24f94/commits",
    VERSION_MANIFEST:
        "https://launchermeta.mojang.com/mc/game/version_manifest.json",
    MCMETA_BLOCK_TEXTURES:
        "https://api.github.com/repos/misode/mcmeta/contents/assets/minecraft/textures/block?ref=assets",
};

const mainForm = document.querySelector("form");
const errorList = /** @type {HTMLUListElement} */ ($("#error-list"));

main();
