# vscode-teamcity-remote-run README

Run Remote Runs on Teamcity.

## Features

Run remote run using command:

|Command|Description|
|-|-|
|```vscode-teamcity-remote-run.remote-run```|Run Remote Run... - runs Remote Run on Teamcity|
|```vscode-teamcity-remote-run.teamcity-login```|Log into Teamcity...|
|```vscode-teamcity-remote-run.perforce-login```|Log into Perforce - login into perforce using ```p4 login -h perforce-hostport``` command in termal|
|||

# The ```.teamcity-mappings.properties``` file

Please create a ```.teamcity-mappings.properties``` file in appropriate workspace folder to map local files to perforce depot paths so that Teamcity can check if you are running Remote Run on compatible Teamcity Build.
## Sample ```.teamcity-mappings.properties```

```
./=perforce://%P4PORT%:////depot/...
```

Make sure to replace P4PORT value (which you can obtain using ```p4 set``` command).

## Known Issues

None.

## Release Notes

### 1.0.10

Initial release.
