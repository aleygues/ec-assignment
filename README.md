# Real time file processing

This is an implementation of the real time file processing architecture on IBM Bluemix. This implementation track changes made on a GitHub repository (push events) and proccess automatically all markdown files (.md) found in the push in order to get them in HTML and TXT format.

This implementation uses the following components:

* a [GitHub](https://github.com/) repository
* an [IBM Bluemix Object Storage](https://console.ng.bluemix.net/catalog/object-storage/) instance
* some [IBM Bluemix OpenWhisk](https://developer.ibm.com/openwhisk/) functions

To process inputs files and get them in different format, JavaScript running on NodeJS is used with the following modules:

* [Marked](https://github.com/chjj/marked) module to process markdown to HTML
* [Remove-markdown](https://github.com/stiang/remove-markdown) module to remove markdown from input file and get simple text

This implementation requires a GitHub account and a IBM Bluemix account. The following steps will guide you from zero to the tests of the implementation.

## Step 0: clone this repo

To setup this implementation, you will need both JS files present in this repo. Clone or download this repository:

    git clone https://github.com/aleygues/ec-assignment

Move to the new folder `cd ec-assignment` and check that both JS files are present.

## Step 1: setup GitHub repo

Create a new GitHub repo (to push files into). Then go to account settings personal access tokens and generate a new one (allowing "Full control of private repositories") in order to get notifications from GitHub. Give a name to your token and copy it.

## Step 2: setup OpenWhisk CLI

Go to [IBM Bluemix OpenWhisk](https://developer.ibm.com/openwhisk/), click on "Using CLI". Download the CLI and install it. Get your token (they are written in the middle of the page to download OpenWhisk CLI).

## Step 3: setup Object storage instance

Go to Bluemix and create a new  [IBM Bluemix Object Storage](https://console.ng.bluemix.net/catalog/object-storage/) service (under service, storage, object storage). Choose the free plan. When the service is ready, go to its configuration panel and create new credentials. These credentials are in JSON format and should look like:

    {
      "auth_url": "https://identity.open.softlayer.com",
      "project": "",
      "projectId": "",
      "region": "dallas",
      "userId": "",
      "username": "",
      "password": "",
      "domainId": "",
      "domainName": "",
      "role": "admin"
    };

You **don't need** to create a new container. In fact the container to upload output files will be automatically created if it does not exist.

## Step 4: prepare processor functions

You have to edit the 2 JS files (processor functions, `processMdToHtml.js` and `processMdToTxt.js`). Open both files and edit the config part as follow:

Copy and past your Object Storage credentials and choose the name of the used container (folder) on Object Storage instance.

`processMdToHtml.js` and `processMdToTxt.js`

    // --------------- CONFIG --------------------
    // CONFIG CLIENT OBJECT STORAGE
    var BLUEMIX_OBJECTSTORAGE_CREDENTIALS = {
      "auth_url": "https://identity.open.softlayer.com",
      "project": "",
      "projectId": "",
      "region": "dallas",
      "userId": "",
      "username": "",
      "password": "",
      "domainId": "",
      "domainName": "",
      "role": "admin"
    };
    var BLUEMIX_OBJECTSTORAGE_CONTAINER = "EC-G6";
    // -------------- END CONFIG ------------------

## Step 5: configure OpenWhisk

You don't need to register or create anything to use OpenWhisk. Just follow the **Step 2** to get the CLI and your credentials.

Setup your account with your credentials (**using OpenWhisk CLI**)

    ./wsk property set --apihost openwhisk.ng.bluemix.net --auth AUTHKEY

Listen for changes on GitHub account (username, repository name, and access token)

    ./wsk package bind /whisk.system/github myGit --param username USERNAME --param repository REPONAME --param accessToken ACCESSTOKEN

Create trigger to get notify action from GitHub

    ./wsk trigger create myGitTrigger --feed myGit/webhook --param events push

Prepare actions (process functions **modified with config**) using path to JS files

    ./wsk action create processMdToHtml path/to/processMdToHtml.js 
    ./wsk action create processMdToTxt path/to/processMdToTxt.js 

If you make some modifications on these files, you can update them running these commands

    ./wsk action update processMdToHtml path/to/processMdToHtml.js 
    ./wsk action update processMdToTxt path/to/processMdToTxt.js 

Bind the actions and the trigger using rules

    ./wsk rule create mdToHtml myGitTrigger processMdToHtml
    ./wsk rule create mdToTxt myGitTrigger processMdToTxt

Keep in mind you can know current rules/actions/triggers using the browser interface or run theses commands 

    ./wsk rule list
    ./wsk action list
    ./wsk trigger list
  

## Step 6: test

Clone your repo **created in step 1** using:

    git clone http://path/to/my/repo

Create a file

    touch test_file.md

Write in the file something like (note that this is markdown contents): 

    ## This is a test 
    
    **This string should be bold** and not this one.
    
    I can write a list:
    
    * one
    * two
    * three
    
    Youpi, great!

Then push the new file 

    git add -A
    git commit -m "First test"
    git push

Pushed files are processed and uploaded to your Object Storage instance under the same name. That means this example create 2  files:

* `myObjectStorage/myContainer/test_file.html`, you can download it and check that Markdown has successfully transformed in HTML.
* `myObjectStorage/myContainer/test_file.txt`, you can download it and check that all Markdown tags have been removed.

*Note: only added and modified files on Github repository are processed.*