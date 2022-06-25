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

function loadFile(filePath) {
    // https://stackoverflow.com/a/41133213/11519302
    var result = null;
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", filePath, false);
    xmlhttp.setRequestHeader("X-Requested-With", "XMLHttpRequest");
    xmlhttp.send();
    if (xmlhttp.status == 200) {
        result = xmlhttp.responseText;
    }
    return result;
}

/**
 * Fetches the data from the remote control gist: https://gist.github.com/MMK21Hub/bbd7afbc74eb582c1a9d78b031b24f94
 * @returns {Promise<{run: boolean, downMsg: string}>}
 */
async function getRemoteControl() {
    const commitList = await fetchJSON(Endpoints.REMOTE_CONTROL_COMMITS);
    const latestCommit = await fetchJSON(commitList[0].url);
    const rawContent = latestCommit.files["remoteControl.json"].content;
    return JSON.parse(rawContent);
}

async function main() {
    const remoteControl = await getRemoteControl();
    const downMsg = remoteControl.downMsg || "";

    // Don't run the app if the site is disabled. Instead, show an error message.
    if (!remoteControl.run) {
        document.getElementById("body").innerHTML =
            "<p>The Options Background Generator has been disabled remotely. Check back later?</p><p><small><em>" +
            downMsg +
            "</em></small></p>";
        return;
    }

    const versionManifest = await fetchJSON(Endpoints.VERSION_MANIFEST);
    console.log("Latest MC version", versionManifest.latest.snapshot);

    const branches = await fetchJSON(Endpoints.MINECRAFT_ASSETS_BRANCHES);
    console.log("minecraft-assets branches", branches);

    const matchingBranches = branches.filter(
        (branch) => branch.name === versionManifest.latest.snapshot
    );
    console.log(
        "minecraft-assets branches that match the latest MC version",
        matchingBranches
    );
}

/** @enum {string} */
const Endpoints = {
    REMOTE_CONTROL_COMMITS:
        "https://api.github.com/gists/bbd7afbc74eb582c1a9d78b031b24f94/commits",
    VERSION_MANIFEST:
        "https://launchermeta.mojang.com/mc/game/version_manifest.json",
    MINECRAFT_ASSETS_BRANCHES:
        "https://api.github.com/repos/InventivetalentDev/minecraft-assets/branches?page=3",
};

main();
