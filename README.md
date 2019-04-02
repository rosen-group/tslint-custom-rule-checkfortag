# tslint-custom-rule-checkfortag

Custom TsLint Rule that is doing almost the same as the default deprecation rule. But the rule is not seaching for the @deprecation tag but for custom tags. These unwanted tags can be specifiedin the rule options.

## Installation & Configuration
The rule is available as a npm package. First install the package:
```$xslt
npm install --save-dev @rosen-group/tslint-custom-rule-checkfortag
```
### tslint.json
Inside your tslint.json file include the directory with the rule:
```
"rulesDirectory": [
    "node_modules/@rosen-group/tslint-custom-rule-checkfortag/"
]
```

And add a rule for the Tag you want to avoid. Tags are specified as an array of strings:    
```
"check-for-tag": {
    "options": [
        true,
        ["ContactArchitectureBeforeUse"]
    ],
    "severity": "warning"
}
``` 

Or specify multiple unwanted tags:
```
"check-for-tag": {
    "options": [
        true,
        ["ContactArchitectureBeforeUse", "MarkedForDeletion"]
    ],
    "severity": "warning"
}
``` 

**Important notice:** the short config form ```"check-for-tag": [true, ["ContactArchitectureBeforeUse"]]``` is not supported yet!
        
## Disable warning
To allow the usage of tags in some cases just use the default TsLint syntax:
```
/* tslint:disable:check-for-tag */
    /**
     * Demo method
     * @param message Text to output
     * @ContactArchitectureBeforeUse
     */
    public helloWorld(message : string) : string {
        return 'Hello '+message;
    }
/* tslint:enable:check-for-tag */
```