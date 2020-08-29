function loadFile(filePath) { // https://stackoverflow.com/a/41133213/11519302
    var result = null;
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open("GET", filePath, false);
    xmlhttp.setRequestHeader('x-requested-with', 'XMLHttpRequest');
    xmlhttp.send();
    if (xmlhttp.status == 200) {
        result = xmlhttp.responseText;
    }
    return result;
}

commitsList = JSON.parse(loadFile("https://api.github.com/gists/bbd7afbc74eb582c1a9d78b031b24f94/commits"))
latestCommit = loadFile(commitsList[0].url)
remoteControl = latestCommit.files
console.log(remoteControl)
/*if (remoteControl.run == true) {
    console.log("run")
} else{
    document.getElementById("body").innerHTML("<p>Hello</p>")
}*/