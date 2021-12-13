/* eslint-disable @typescript-eslint/naming-convention */
import * as vscode from 'vscode';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

let tccDotJar = 'tcc-9.x.x.jar';

const BRANCH_TO_PROJECT_ID_MAP:any = {
    '/Main/Clients/webapp/infoarchiveng': 'InfoArchive_Main_Iawa',
    '/rel_IA_21.4/Clients/webapp/infoarchiveng': 'InfoArchive_214',
    '/rel_IA_21.2/Clients/webapp/infoarchiveng': 'InfoArchive_212',
    '/rel_IA_20.4/Clients/webapp/infoarchiveng': 'InfoArchive_204',
    '/rel_IA_20.2/Clients/webapp/infoarchiveng': 'InfoArchive_202',
    '/Main/Servre': 'InfoArchive_Main_IaServer',
    '/rel_IA_21.4/Server': 'InfoArchive_214_IaServer',
    '/rel_IA_21.2/Server': 'InfoArchive_212_IaServer',
    '/rel_IA_20.4/Server': 'InfoArchive_204_IaServer',
    '/rel_IA_20.2/Server': 'InfoArchive_202_IaServer',
    // '/Main/Tools/': 'InfoArchive_Main_IaServer',
    // '/rel_IA_21.4/Tools/': 'InfoArchive_214_IaServer',
    // '/rel_IA_21.2/Tools/': 'InfoArchive_212_IaServer',
    // '/rel_IA_20.4/Tools/': 'InfoArchive_204_IaServer',
};

let client: string;
let clientRoot: string;
let projectId: string;
let workspaceFolderPath: string;


export function activate(context: vscode.ExtensionContext) {
    tccDotJar = path.join(context.extensionPath, tccDotJar);

    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
        workspaceFolderPath = workspaceFolders[0].uri.fsPath;
        Object.keys(BRANCH_TO_PROJECT_ID_MAP).forEach( key => {
            const cannanicalKey = key.replace(/\//g, path.sep).replace(/\\/g, path.sep);
            if (workspaceFolderPath.indexOf(cannanicalKey) !== -1) {
                projectId = BRANCH_TO_PROJECT_ID_MAP[key];
            }
        });
    }

    let disposable = vscode.commands.registerCommand('vscode-teamcity-remote-run.remote-run', remoteRun);
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('vscode-teamcity-remote-run.teamcity-login', teamcityLogin);
    context.subscriptions.push(disposable);

    disposable = vscode.commands.registerCommand('vscode-teamcity-remote-run.perforce-login', perforceLogin);
    context.subscriptions.push(disposable);

    child_process.exec(`p4 info`, async (err, stdout, stderr) => {
        if (err) {
            vscode.window.showErrorMessage(err.message);
            return;
        }

        const infos = stdout.split(/\r?\n/);
        infos.forEach(info => {
            if (info.startsWith('Client name: ')) {
                client = info.substring(13);
            }
            if (info.startsWith('Client root: ')) {
                clientRoot = info.substring(13);
            }
        });
    });
}

async function remoteRun() {
    if (!projectId) {
        vscode.window.showErrorMessage(`No Teamcity project id found for current workspace.`);
        return;
    }
    if (client && clientRoot) {
        child_process.exec(`p4 info`, async (err, stdout, stderr) => {
            if (err) {
                vscode.window.showErrorMessage(err.message);
                return;
            }
            const infos = stdout.split('\n');
        });

        child_process.exec(`p4 changes -c ${client} -s pending`, async (err, stdout, stderr) => {
            if (err) {
                vscode.window.showErrorMessage(err.message);
                return;
            }
            const pendingChangelistsLines = stdout.split(/\r?\n/)
                .filter(change => change.startsWith('Change '));
            const pendingChangelists = pendingChangelistsLines
                .map((change) => change.split(' ')[1]);
            let pendingChangelistsDescriptions = pendingChangelistsLines
                .filter(pendingChangelistLine =>  pendingChangelistLine.startsWith(`Change `))
                .map((change) => change.split(' *pending* ')[1].replace(/^'/, '').replace(/'$/, ''));

            const pendingChangelistQuickPicks = pendingChangelistsLines
                .map(pendingChangelistsLine => {
                    const pendingChangelist = pendingChangelistsLine.split(' ')[1];
                    const pendingChangelistsDescription = pendingChangelistsLine.split(' *pending* ')[1].replace(/^'/, '').replace(/'$/, '');

                    return {
                        value: pendingChangelist,
                        label: pendingChangelist,
                        description: pendingChangelistsDescription,
                        details: pendingChangelistsDescription,
                    };
                });

            const pendingChangelistQuickPickItem = await vscode.window.showQuickPick(pendingChangelistQuickPicks, {
                placeHolder: 'Select pending changelist'
            });
            if (pendingChangelistQuickPickItem) {
                const pendingChangelist = pendingChangelistQuickPickItem?.value;
                let pendingChangelistsDescription = pendingChangelistsLines
                    .filter(pendingChangelistLine =>  pendingChangelistLine.startsWith(`Change ${pendingChangelist}`))
                    .map((change) => change.split(' *pending* ')[1].replace(/^'/, '').replace(/'$/, ''))[0];
                pendingChangelistsDescription = `Remote Run for changelist ${pendingChangelist} from VSCode.`;
                child_process.exec(`p4 -ztag opened -C ${client} -c ${pendingChangelist}`, async (err, stdout, stderr) => {
                    if (err) {
                        vscode.window.showErrorMessage(err.message);
                        return;
                    }
                    const pendingChangelistFiles = stdout.split(/\r?\n/)
                        .filter(change => change.startsWith('... clientFile '))
                        .map((change) => change.split(' ')[2])
                        .map(change => change.replace(`//${client}`, `${clientRoot}`))
                        .map(change => change.replace(/\//g, path.sep).replace(/\\/g, path.sep));
                    child_process.exec(`java -jar ${tccDotJar} info -p ${projectId}`, async (err, stdout, stderr) => {
                        if (err) {
                            vscode.window.showErrorMessage(err.message);
                            return;
                        }
                        const configIds = stdout.split(/\r?\n/)
                            .filter(change => change.trim().length > 0)
                            .map((change) => change.split(' ')[0]);
                        do {
                            configIds.shift();
                        }  while (configIds.length > 0 && configIds[0] !== 'id');
                        if (configIds.length > 0) {
                            configIds.shift();
                        }
                        if (configIds.length > 0) {
                            const configId = await vscode.window.showQuickPick(configIds, {
                                placeHolder: 'Select target build to run Remote run'
                            });
                            if (configId) {
                                const tempFolderForWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), `${client}-`));
                                const pendingChangelistFilelistFile = path.join(tempFolderForWorkspace, `p4-changelist-${pendingChangelist}.filelist`);
                                fs.writeFileSync(pendingChangelistFilelistFile, pendingChangelistFiles.join('\n'));
                                child_process.exec(`java -jar ${tccDotJar} run -n --force-compatibility-check -c ${configId} -m """${pendingChangelistsDescription}""" @${pendingChangelistFilelistFile}`, async (err, stdout, stderr) => {
                                    if (err) {
                                        vscode.window.showErrorMessage(err.message);
                                        return;
                                    }
                                    vscode.window.showInformationMessage(`Started remote run on Tecamcity build ${configId}`);
                                });
                            }
                        }
                    });
                });
            }
        });
    }
}

async function teamcityLogin() {
    const vscodeTeamcityRemoteRunConfig = vscode.workspace.getConfiguration('vscode-teamcity-remote-run');
    if (vscodeTeamcityRemoteRunConfig) {
        const teamcityServerURL = vscodeTeamcityRemoteRunConfig.teamcityServerURL;
        const teamcityUser = vscodeTeamcityRemoteRunConfig.teamcityUser;

        const teamcityPassword = await vscode.window.showInputBox({
            placeHolder: 'Teamcity password',
            prompt:  `Teamcity password for user ${teamcityUser} on ${teamcityServerURL}:`,
            password: true,
            title: 'Login into Teamcity'
        });
        if (teamcityPassword) {
            child_process.exec(`java -jar ${tccDotJar} login --host "${teamcityServerURL}" --user "${teamcityUser}" --password "${teamcityPassword}"`, async (err, stdout, stderr) => {
                if (err) {
                    vscode.window.showErrorMessage(err.message);
                    return;
                }
                vscode.window.showInformationMessage(`Logged is as user ${teamcityUser} on ${teamcityServerURL}.`);
            });
        }
    }
}

async function perforceLogin() {
    const vscodePerforceRemoteRunConfig = vscode.workspace.getConfiguration('vscode-teamcity-remote-run');
    if (vscodePerforceRemoteRunConfig) {
        const perforceHostColonPort = vscodePerforceRemoteRunConfig.perforceHostColonPort;
        const perforceUser = vscodePerforceRemoteRunConfig.perforceUser;
        const terminal = vscode.window.activeTerminal || vscode.window.createTerminal('p4 login');
        terminal.sendText(`REM Use the hash code output by succesfully loggging in and set the environment variable P4PASSWD to it and restart VCSCode.\r\n`);
        terminal.sendText(`p4 login -p -h "${perforceHostColonPort}"\r\n`);
        terminal.show();
        // const perforcePassword = await vscode.window.showInputBox({
        //     placeHolder: 'Perforce password',
        //     prompt:  `Perforce password for user ${perforceUser} on ${perforceHostColonPort}:`,
        //     password: true,
        //     title: 'Login into Perforce'
        // });
        // if (perforcePassword) {
        //     child_process.exec(`p4 login -h """${perforceHostColonPort}""" """${perforceUser}""`, async (err, stdout, stderr) => {
        //         if (err) {
        //             vscode.window.showErrorMessage(err.message);
        //             return;
        //         }
        //         vscode.window.showInformationMessage(`Logged is as user ${perforceUser} on ${perforceHostColonPort}.`);
        //     });
        // }
    }
}


// this method is called when your extension is deactivated
export function deactivate() {}
