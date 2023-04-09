// @ts-ignore
import hyperScriptImport from "https://cdn.skypack.dev/hyperscript";
// @ts-ignore
import hyperScriptHelpersImport from "https://cdn.skypack.dev/hyperscript-helpers";

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
 * A utility for asynchronously fetching JSON data
 * @param {string} url
 * @param {RequestInit} [options]
 */
function fetchJSON(url, options) {
    return fetch(url.toString(), options).then((res) => res.json());
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
    const commitList = await fetchJSON(Endpoints.REMOTE_CONTROL_COMMITS);
    const latestCommit = await fetchJSON(commitList[0].url);
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
async function getTextureFileData(name) {
    const matchingFile = textureFileList.find((f) => f.name === name);
    if (!matchingFile)
        throw new Error(`Couldn't find a texture with the filename ${name}`);

    const url = matchingFile.download_url;

    const fileContent = await fetch(url, {
        headers: {
            Accept: "image/png",
        },
    }).then((res) => res.arrayBuffer());

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
        placeholderElement.setAttribute("data-form-placeholder", "true");

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
 * @returns {Promise<boolean>} `true` if the remote control is allowing the site to run.
 */
async function checkRemoteControl() {
    const forceDisabled = urlParams.has("disabled");

    if (forceDisabled) {
        showSiteDisabledNote();
        return false;
    }

    if (window.location.host !== "mmk21hub.github.io") return true;

    const remoteControl = await getRemoteControl();
    if (remoteControl.run) return true;

    showSiteDisabledNote(remoteControl);
    return false;
}

async function loadSelectorContents() {
    const textureSelector = /** @type {HTMLSelectElement} */ (
        $("#texture-selector")
    );

    const { removePlaceholder } = disableForm("Loading texture list...");

    /** @type {GithubFileInfo[]} */
    let textureDirContents;
    try {
        textureDirContents = await fetchJSON(Endpoints.MCMETA_BLOCK_TEXTURES, {
            signal: AbortSignal.timeout(0 * 1000),
        });
    } catch (error) {
        disableForm("Failed to fetch textures!");
        $("#refresh-texture-list").removeAttribute("hidden");
        throw error;
    }

    const textureFiles = textureDirContents.filter((f) => f.type === "file");
    textureFileList = textureFiles;
    console.log(
        `Fetched data for ${textureFiles.length} textures from the mcmeta repository on GitHub`
    );

    textureFiles.forEach((textureFile) => {
        const option = document.createElement("option");
        option.value = textureFile.name;
        // Only use the basename of the file (ignore the .png extension)
        option.textContent = textureFile.name.replace(/^(.*)\.(\w+)$/, "$1");
        textureSelector.appendChild(option);
    });

    removePlaceholder();
}

/** @param {Event} e */
async function activateGenerator(e) {
    if (!(e.target instanceof HTMLFormElement)) return;
    e.preventDefault();
    const formData = new FormData(e.target);
    const textureName = formData.get("selected-texture").toString();

    const { removePlaceholder } = disableForm("Fetching texture...");
    const textureData = await getTextureFileData(textureName);
    removePlaceholder();
    console.log(`Texture data for ${textureName}`, textureData);
}

async function reloadTextureList() {
    123;
}

async function main() {
    const shouldRun = await checkRemoteControl();
    if (!shouldRun) return;

    const versionManifest = await fetchJSON(Endpoints.VERSION_MANIFEST, {});
    console.log("Latest MC version", versionManifest.latest.snapshot);

    await loadSelectorContents();
    mainForm.addEventListener("submit", activateGenerator);
}

/** @type {import("hyperscript")} */
const hyperScript = hyperScriptImport;
/** @type {import("./hyperscript").default} */
const hyperScriptHelpers = hyperScriptHelpersImport;
const { div, p, em, option } = hyperScriptHelpers(hyperScript);

/** @enum {string} */
const Endpoints = {
    REMOTE_CONTROL_COMMITS:
        "https://api.github.com/gists/bbd7afbc74eb582c1a9d78b031b24f94/commits",
    VERSION_MANIFEST:
        "https://launchermeta.mojang.com/mc/game/version_manifest.json",
    MCMETA_BLOCK_TEXTURES:
        "https://api.github.com/repos/misode/mcmeta/contents/assets/minecraft/textures/block?ref=assets",
};

/**
 * Shorthand for {@link document.querySelector} (gets an element from the DOM using a CSS selector)
 * @param {string} selector A string representing a CSS selector
 * @returns {Element | null} The first Element within the document that matches the specified selector, or null if no matches are found
 */
const $ = (selector) => document.querySelector(selector);
/** Shorthand access to the current URL parameters */
const urlParams = new URLSearchParams(window.location.search);
/** An array of GitHub files for each available texture @type {GithubFileInfo[]} */
let textureFileList;

const mainForm = document.querySelector("form");

main();
