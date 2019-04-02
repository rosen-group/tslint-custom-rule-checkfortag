/**
 * Based on tslint deprecation rule
 * https://github.com/palantir/tslint/blob/master/src/rules/deprecationRule.ts
 * Customized to search for specified tags (provided as as rule options) instead of deprecated tag
 */

import {
    getDeclarationOfBindingElement,
    getJsDoc,
    isBindingElement,
    isCallExpression,
    isIdentifier,
    isNewExpression,
    isPropertyAccessExpression,
    isPropertyAssignment,
    isReassignmentTarget,
    isShorthandPropertyAssignment,
    isSymbolFlagSet,
    isTaggedTemplateExpression,
    isVariableDeclaration,
    isVariableDeclarationList,
} from "tsutils";
import * as ts from "typescript";
import {Rules, IRuleMetadata, RuleFailure, WalkContext, Utils} from "tslint";

var options : any;

export class Rule extends Rules.TypedRule {
    public static metadata: IRuleMetadata = {
        ruleName: "check-for-tag",
        description: "Warns when specified tag is used.",
        descriptionDetails: "Warn for usage of @TAG where TAG is specified as option, e.g. @ContactArchitectureBeforeUse",
        optionsDescription: "Argument is a list of tag names to find",
        options: {
            type: "list",
            listType: {
                type: "array",
                items: { type: "string" },
                minLength: 1
            },
        },
        optionExamples: [[true, ["ContactArchitectureBeforeUse"]],
            [true, ["ContactArchitectureBeforeUse", "DoNotUse", "MarkedForDeletion"]]],
        typescriptOnly: false,
        type: "maintainability",
        requiresTypeInfo: true,
    };


    public static FAILURE_STRING(name: string, message: string) {
        return `Found disallowed tag at ${name}${message === "" ? "." : `: ${message.trim()}`}`;
    }


    public applyWithProgram(sourceFile: ts.SourceFile, program: ts.Program): RuleFailure[] {
        return this.applyWithFunction(sourceFile, walk, parseOptions(this.ruleArguments) as any, program.getTypeChecker());
    }
}

function parseOptions(args: Array<string | string[]>) {

    let parsedOptions = [];
    if (args && args[1]) {
        for (const arg of args[1]) {
            parsedOptions.push(arg);
        }
    }
    options = {tags: parsedOptions};
    return options;
}

function walk(ctx: WalkContext<void>, tc: ts.TypeChecker) {
    return ts.forEachChild(ctx.sourceFile, function cb(node): void {
        if (isIdentifier(node)) {
            if (!isDeclaration(node)) {
                const tags = getUnwantedTags(node, tc);
                if (tags !== undefined) {
                    ctx.addFailureAtNode(node, Rule.FAILURE_STRING(node.text, tags));
                }
            }
        } else {
            switch (node.kind) {
                case ts.SyntaxKind.ImportDeclaration:
                case ts.SyntaxKind.ImportEqualsDeclaration:
                case ts.SyntaxKind.ExportDeclaration:
                case ts.SyntaxKind.ExportAssignment:
                    return;
            }
            return ts.forEachChild(node, cb);
        }
    });
}

function isDeclaration(identifier: ts.Identifier): boolean {
    const parent = identifier.parent;
    switch (parent.kind) {
        case ts.SyntaxKind.ClassDeclaration:
        case ts.SyntaxKind.ClassExpression:
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeParameter:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.LabeledStatement:
        case ts.SyntaxKind.JsxAttribute:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.MethodSignature:
        case ts.SyntaxKind.PropertySignature:
        case ts.SyntaxKind.TypeAliasDeclaration:
        case ts.SyntaxKind.GetAccessor:
        case ts.SyntaxKind.SetAccessor:
        case ts.SyntaxKind.EnumDeclaration:
        case ts.SyntaxKind.ModuleDeclaration:
            return true;
        case ts.SyntaxKind.VariableDeclaration:
        case ts.SyntaxKind.Parameter:
        case ts.SyntaxKind.PropertyDeclaration:
        case ts.SyntaxKind.EnumMember:
        case ts.SyntaxKind.ImportEqualsDeclaration:
            return (parent as ts.NamedDeclaration).name === identifier;
        case ts.SyntaxKind.PropertyAssignment:
            return (
                (parent as ts.PropertyAssignment).name === identifier &&
                !isReassignmentTarget(identifier.parent.parent as ts.ObjectLiteralExpression)
            );
        case ts.SyntaxKind.BindingElement:
            // return true for `b` in `const {a: b} = obj"`
            return (
                (parent as ts.BindingElement).name === identifier &&
                (parent as ts.BindingElement).propertyName !== undefined
            );
        default:
            return false;
    }
}

function getCallExpresion(node: ts.Expression): ts.CallLikeExpression | undefined {
    let parent = node.parent;
    if (isPropertyAccessExpression(parent) && parent.name === node) {
        node = parent;
        parent = node.parent;
    }
    return isTaggedTemplateExpression(parent) ||
    ((isCallExpression(parent) || isNewExpression(parent)) && parent.expression === node)
        ? parent
        : undefined;
}

function getUnwantedTags(node: ts.Identifier, tc: ts.TypeChecker): string | undefined {
    const callExpression = getCallExpresion(node);
    if (callExpression !== undefined) {
        const result = getSignatureUnwantedTags(tc.getResolvedSignature(callExpression));
        if (result !== undefined) {
            return result;
        }
    }
    let symbol: ts.Symbol | undefined;
    const parent = node.parent;
    if (parent.kind === ts.SyntaxKind.BindingElement) {
        symbol = tc.getTypeAtLocation(parent.parent).getProperty(node.text);
    } else if (
        (isPropertyAssignment(parent) && parent.name === node) ||
        (isShorthandPropertyAssignment(parent) &&
            parent.name === node &&
            isReassignmentTarget(node))
    ) {
        symbol = tc.getPropertySymbolOfDestructuringAssignment(node);
    } else {
        symbol = tc.getSymbolAtLocation(node);
    }

    if (symbol !== undefined && isSymbolFlagSet(symbol, ts.SymbolFlags.Alias)) {
        symbol = tc.getAliasedSymbol(symbol);
    }
    if (
        symbol === undefined ||
        // if this is a CallExpression and the declaration is a function or method,
        // stop here to avoid collecting JsDoc of all overload signatures
        (callExpression !== undefined && isFunctionOrMethod(symbol.declarations))
    ) {
        return undefined;
    }
    return getSymbolUnwantedTags(symbol);
}

function findUnwantedTagsTag(tags: ts.JSDocTagInfo[]): string | undefined {
    for (const tag of tags) {
        if (options.tags.includes(tag.name)){
            return tag.text === undefined ? "" : tag.text;
        }
    }
    return undefined;
}

function getSymbolUnwantedTags(symbol: ts.Symbol): string | undefined {
    if (symbol.getJsDocTags !== undefined) {
        return findUnwantedTagsTag(symbol.getJsDocTags());
    }
    // for compatibility with typescript@<2.3.0
    return getUnwantedTagsFromDeclarations(symbol.declarations);
}

function getSignatureUnwantedTags(signature?: ts.Signature): string | undefined {
    if (signature === undefined) {
        return undefined;
    }
    if (signature.getJsDocTags !== undefined) {
        return findUnwantedTagsTag(signature.getJsDocTags());
    }

    // for compatibility with typescript@<2.3.0
    return signature.declaration === undefined
        ? undefined
        : getUnwantedTagsFromDeclaration(signature.declaration);
}

function getUnwantedTagsFromDeclarations(declarations?: ts.Declaration[]): string | undefined {
    if (declarations === undefined) {
        return undefined;
    }
    let declaration: ts.Node;
    for (declaration of declarations) {
        if (isBindingElement(declaration)) {
            declaration = getDeclarationOfBindingElement(declaration);
        }
        if (isVariableDeclaration(declaration)) {
            declaration = declaration.parent;
        }
        if (isVariableDeclarationList(declaration)) {
            declaration = declaration.parent;
        }
        const result = getUnwantedTagsFromDeclaration(declaration);
        if (result !== undefined) {
            return result;
        }
    }
    return undefined;
}

function getUnwantedTagsFromDeclaration(declaration: ts.Node): string | undefined {
    for (const comment of getJsDoc(declaration)) {
        if (comment.tags === undefined) {
            continue;
        }
        for (const tag of comment.tags) {
            if (options.tags.includes(tag.tagName.text)){
                return tag.comment === undefined ? "" : tag.comment;
            }
        }
    }
    return undefined;
}

function isFunctionOrMethod(declarations?: ts.Declaration[]) {
    if (declarations === undefined || declarations.length === 0) {
        return false;
    }
    switch (declarations[0].kind) {
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.FunctionDeclaration:
        case ts.SyntaxKind.FunctionExpression:
        case ts.SyntaxKind.MethodSignature:
            return true;
        default:
            return false;
    }
}