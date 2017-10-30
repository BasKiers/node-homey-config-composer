# Homey Config Composer

Handy tool to split up the app.json file into multiple (js/json) files. Composer will search through a config folder and append all found files to the app.json file

Example:
```
/
drivers/
    ...    
config/
    drivers/
        sockets/
            socketA.js
            socketB.js
        defaultDrivers.json
    flow/
        triggers/
            socketA/
                whenOff.js
            socketB.js
    signals/
        433/
            somfy.js
    locales/
        en/
            pair.js
            settings.json
        nl.js // Locales files are merged into locales/[lang].json and suffixed with an empty character "\u0000". 
              // If there is a collision with an entry in locales/[lang].json without the "\u0000" suffix the key will not be overwritten by the config parser.
    config.js // This file will be merged with the app.json file before all other files/folders are merged
    script.js // This file can export a function that is called with the merged config at the end and can make changes before writing to app.json
app.json
```

The files should be inside a folder corresponding to the place in the config file.
These supported folders are:
```
drivers
flow/triggers
flow/conditions
flow/actions
signals
screensavers
speech
locales
```

The files inside these folders should contain an Object (e.g. the config for one device) or an Array of such Objects.

**Note. When you create a folder (e.g. config/drivers) and run Homey Config Composer, all entries of this type in the app.json file will be overwritten!**

### How to use

Install Homey Config Composer by executing the following command
```npm install -g node-homey-config-composer```

To use this program create a `config` folder in the root of your Homey project and add the config files you need in the corresponding folders.
When changes are made to the files in the config folder you can merge them into the app.json file by calling 
```homeyConfig compose``` 
from the root of the project.
