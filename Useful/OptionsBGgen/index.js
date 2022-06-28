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

/** Utility function that uses the CORS Everywhere service to access a URL without CORS errors
 * @param {string} url
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
 * @param {RemoteControlData} data The information to include in the notice
 */
function showSiteDisabledNote(data) {
    const { downMsg, commitTimestamp, commitAuthor } = data;
    const messageElement = `<p id="site-disabled-note">The Options Background Generator has been disabled remotely. Check back later?</p>`;
    document.querySelector("body").innerHTML = messageElement;
    if (!downMsg) return;

    const siteDisabledNote = document.querySelector("#site-disabled-note");
    siteDisabledNote.insertAdjacentHTML(
        "afterend",
        `<p id="site-disabled-message">Message provided by </p>`
    );
    const siteDisabledMessage = document.querySelector(
        "#site-disabled-message"
    );

    siteDisabledMessage.textContent = `Message provided by ${commitAuthor}: `;
    siteDisabledMessage.insertAdjacentHTML("beforeend", `<em></em>`);
    siteDisabledMessage.querySelector("em").textContent = downMsg;

    if (!commitTimestamp) return;
    siteDisabledMessage.insertAdjacentHTML(
        "afterend",
        `<p id="site-disabled-timestamp">Remote control last updated </p>`
    );
    document
        .querySelector("#site-disabled-timestamp")
        .insertAdjacentText("beforeend", commitTimestamp.toLocaleString());
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
    /** @type {HTMLSelectElement} */
    const selector = document.querySelector("#texture-selector");
    /** @type {HTMLButtonElement} */
    const button = document.querySelector("#main-button");

    // Store old state
    const oldValue = selector.value;

    // Keep track of the element being used as a placeholder option
    /** @type {HTMLOptionElement} */
    let placeholderElement = null;

    setTimeout(() => {
        // Disable the form
        selector.disabled = true;
        button.disabled = true;

        // Set the placeholder
        placeholderElement = new Option(placeholder, placeholderValue);
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
        // If the state change hasn't happened yet,
        // just modify the string that will be used
        // as the placeholder text
        if (!placeholderElement) placeholder = text;

        placeholderElement.textContent = text;
    }

    return {
        removePlaceholder,
        updatePlaceholder,
    };
}

/**
 * @returns {Promise<boolean>} `true` if the remote control is allowing the site to run, or if it's being ignored.
 */
async function checkRemoteControl() {
    if (window.location.host !== "mmk21hub.github.io") return true;

    const remoteControl = await getRemoteControl();
    if (remoteControl.run) return true;

    showSiteDisabledNote(remoteControl);
    return false;
}

async function loadSelectorContents() {
    /** @type {HTMLSelectElement} */
    const textureSelector = document.querySelector("#texture-selector");

    const { removePlaceholder } = disableForm("Loading texture list...");

    /** @type {GithubFileInfo[]} */
    const textureDirContents = await fetchJSON(Endpoints.MCMETA_BLOCK_TEXTURES);
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

async function main() {
    const shouldRun = await checkRemoteControl();
    if (!shouldRun) return;

    const versionManifest = await fetchJSON(Endpoints.VERSION_MANIFEST, {});
    console.log("Latest MC version", versionManifest.latest.snapshot);

    await loadSelectorContents();
    document
        .querySelector("form")
        .addEventListener("submit", activateGenerator);
}

/** @type {import("hyperscript")} */
const hyperScript = hyperScriptImport;
/** @type {import("./hyperscript").default} */
const hyperScriptHelpers = hyperScriptHelpersImport;
const { p, em, option } = hyperScriptHelpers(hyperScript);

/** @enum {string} */
const Endpoints = {
    REMOTE_CONTROL_COMMITS:
        "https://api.github.com/gists/bbd7afbc74eb582c1a9d78b031b24f94/commits",
    VERSION_MANIFEST:
        "https://launchermeta.mojang.com/mc/game/version_manifest.json",
    MCMETA_BLOCK_TEXTURES:
        "https://api.github.com/repos/misode/mcmeta/contents/assets/minecraft/textures/block?ref=assets",
};

/** @type {GithubFileInfo[]} */
let textureFileList;

main();
