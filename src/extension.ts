import type { ExtensionContext } from 'vscode'

import { execSync } from 'node:child_process'

import { commands, env, Uri, window, workspace } from 'vscode'

import { logger } from './utils/debugger'

type GitHubRepoInfo = {
  username: string
  repoName: string
}

function getRepoInfo(workspacePath: string): GitHubRepoInfo | null {
  try {
    const remoteUrl = execSync('git remote get-url origin', {
      cwd: workspacePath,
      encoding: 'utf8',
      timeout: 5000,
    }).trim()

    // SSH format: git@github.com:username/repo.git
    const sshMatch = remoteUrl.match(/git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/)
    // HTTPS format: https://github.com/username/repo.git
    const httpsMatch = remoteUrl.match(/https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/)
    const match = sshMatch ?? httpsMatch

    return match
      ? { username: match[1], repoName: match[2] }
      : null
  } catch {
    return null
  }
}

function getCurrentBranch(workspacePath: string): string {
  try {
    return execSync('git branch --show-current', {
      cwd: workspacePath,
      encoding: 'utf8',
    }).trim() ?? 'main'
  } catch {
    return 'main'
  }
}

function validateWorkspace() {
  const workspaceFolders = workspace.workspaceFolders
  if (!workspaceFolders?.[0]) {
    window.showWarningMessage('No workspace folder found to open on GitHub.')
    return null
  }
  return workspaceFolders[0]
}

function validateGitRepository(workspacePath: string) {
  const repoInfo = getRepoInfo(workspacePath)
  if (repoInfo === null) {
    window.showWarningMessage('Not a git repository. Initiate one with `git init` or check your remote URL.')
    return null
  }
  return repoInfo
}

export function activate(context: ExtensionContext) {
  logger.info('📂 Reveal on GitHub activated.')

  context.subscriptions.push(
    commands.registerCommand('openOnGitHub.openProject', async () => {
      const folder = validateWorkspace()
      if (!folder) {
        return
      }

      const repoInfo = validateGitRepository(folder.uri.fsPath)
      if (repoInfo === null) {
        return
      }

      const repoUrl = `${repoInfo.username}/${repoInfo.repoName}`
      logger.info(`Opening project on GitHub: ${repoUrl}`)

      env.openExternal(Uri.from({
        scheme: 'https',
        authority: 'github.com',
        path: repoUrl,
      }))
    }),

    commands.registerCommand('openOnGitHub.openFile', async () => {
      const workspaceFolder = validateWorkspace()
      if (workspaceFolder === null) {
        return
      }

      const filePath = workspaceFolder.uri.fsPath

      const repoInfo = validateGitRepository(filePath)
      if (repoInfo === null) {
        return
      }

      const { fileName } = window.activeTextEditor?.document ?? {}
      if (fileName === undefined) {
        window.showWarningMessage('Open a file to use Open on GitHub command.')
        return
      }

      const relativePath = workspace.asRelativePath(fileName)
      const currentBranch = getCurrentBranch(filePath)
      const repoFileUrl = `${repoInfo.username}/${repoInfo.repoName}/blob/${currentBranch}/${relativePath}`

      logger.info(`Opening file on GitHub: ${repoFileUrl}`)

      env.openExternal(Uri.from({
        scheme: 'https',
        authority: 'github.com',
        path: repoFileUrl,
      }))
    }),
  )
}
