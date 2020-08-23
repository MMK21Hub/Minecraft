function loadFile(filePath) {
    var result = null;
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", filePath, false);
    xmlhttp.send();
    if (xmlhttp.status == 200) {
        result = xmlhttp.responseText;
    }
    return result;
}

remoteControlRaw = loadFile("https://gist.githubusercontent.com/MMK21Hub/bbd7afbc74eb582c1a9d78b031b24f94/raw/e2b3ee285f9f1c27d6899cc5fcb163667808fce3/remoteControl.json")
window.remoteControl = JSON.parse(remoteControlRaw)
console.log(remoteControl)
if (remoteControl.run == true) {
    console.log("run")
}