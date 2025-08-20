import type { ExtensionContext } from 'vscode'

import { execSync } from 'node:child_process'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commands, env, Uri, window, workspace } from 'vscode'

import { activate } from '../src/extension'

vi.mock('vscode', () => ({
  commands: {
    registerCommand: vi.fn(),
  },
  window: {
    showWarningMessage: vi.fn(),
    activeTextEditor: null,
  },
  workspace: {
    workspaceFolders: null,
    asRelativePath: vi.fn(),
  },
  env: {
    openExternal: vi.fn(),
  },
  Uri: {
    from: vi.fn(),
  },
}))

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

vi.mock('../src/utils/debugger', () => ({
  logger: {
    info: vi.fn(),
  },
}))

describe('Extension', () => {
  let mockContext: ExtensionContext

  beforeEach(() => {
    vi.clearAllMocks()
    mockContext = {
      subscriptions: [],
    } as any
  })

  describe('activate', () => {
    it('registers openProject and openFile commands', () => {
      activate(mockContext)

      expect(commands.registerCommand).toHaveBeenCalledTimes(2)
      expect(commands.registerCommand).toHaveBeenCalledWith('openOnGitHub.openProject', expect.any(Function))
      expect(commands.registerCommand).toHaveBeenCalledWith('openOnGitHub.openFile', expect.any(Function))
    })
  })

  describe('openProject command', () => {
    it('shows warning when no workspace folder', async () => {
      vi.mocked(workspace).workspaceFolders = undefined
      activate(mockContext)

      const openProjectCommand = vi.mocked(commands.registerCommand).mock.calls[0][1]
      await openProjectCommand()

      expect(window.showWarningMessage).toHaveBeenCalledWith('No workspace folder found to open on GitHub.')
    })

    it('opens GitHub URL for SSH remote', async () => {
      vi.mocked(workspace).workspaceFolders = [{ uri: { fsPath: '/test/path' } }] as any
      vi.mocked(execSync).mockReturnValue('git@github.com:username/repo.git\n')
      activate(mockContext)

      const openProjectCommand = vi.mocked(commands.registerCommand).mock.calls[0][1]
      await openProjectCommand()

      expect(env.openExternal).toHaveBeenCalled()
      expect(Uri.from).toHaveBeenCalledWith({
        scheme: 'https',
        authority: 'github.com',
        path: 'username/repo',
      })
    })

    it('opens GitHub URL for alternative SSH remote', async () => {
      vi.mocked(workspace).workspaceFolders = [{ uri: { fsPath: '/test/path' } }] as any
      vi.mocked(execSync).mockReturnValue('ssh://git@host-github/username/repo.git\n')
      activate(mockContext)

      const openProjectCommand = vi.mocked(commands.registerCommand).mock.calls[0][1]
      await openProjectCommand()

      expect(env.openExternal).toHaveBeenCalled()
      expect(Uri.from).toHaveBeenCalledWith({
        scheme: 'https',
        authority: 'github.com',
        path: 'username/repo',
      })
    })

    it('opens GitHub URL for HTTPS remote', async () => {
      vi.mocked(workspace).workspaceFolders = [{ uri: { fsPath: '/test/path' } }] as any
      vi.mocked(execSync).mockReturnValue('https://github.com/username/repo.git\n')
      activate(mockContext)

      const openProjectCommand = vi.mocked(commands.registerCommand).mock.calls[0][1]
      await openProjectCommand()

      expect(env.openExternal).toHaveBeenCalled()
      expect(Uri.from).toHaveBeenCalledWith({
        scheme: 'https',
        authority: 'github.com',
        path: 'username/repo',
      })
    })

    it('shows warning for invalid git repository', async () => {
      vi.mocked(workspace).workspaceFolders = [{ uri: { fsPath: '/test/path' } }] as any
      vi.mocked(execSync).mockImplementation(() => {
        throw new Error('Not a git repository')
      })
      activate(mockContext)

      const openProjectCommand = vi.mocked(commands.registerCommand).mock.calls[0][1]
      await openProjectCommand()

      expect(window.showWarningMessage).toHaveBeenCalledWith('Not a git repository. Initiate one with `git init` or check your remote URL.')
    })
  })

  describe('openFile command', () => {
    it('shows warning when no active editor', async () => {
      vi.mocked(workspace).workspaceFolders = [{ uri: { fsPath: '/test/path' } }] as any
      vi.mocked(execSync).mockReturnValue('git@github.com:username/repo.git\n')
      vi.mocked(window).activeTextEditor = undefined
      activate(mockContext)

      const openFileCommand = vi.mocked(commands.registerCommand).mock.calls[1][1]
      await openFileCommand()

      expect(window.showWarningMessage).toHaveBeenCalledWith('Open a file to use Open on GitHub command.')
    })

    it('opens GitHub file URL with current branch', async () => {
      vi.mocked(workspace).workspaceFolders = [{ uri: { fsPath: '/test/path' } }] as any
      vi.mocked(execSync)
        .mockReturnValueOnce('git@github.com:username/repo.git\n')
        .mockReturnValueOnce('feature-branch\n')
      vi.mocked(window).activeTextEditor = {
        document: { fileName: '/test/path/src/file.ts' },
      } as any
      vi.mocked(workspace.asRelativePath).mockReturnValue('src/file.ts')
      activate(mockContext)

      const openFileCommand = vi.mocked(commands.registerCommand).mock.calls[1][1]
      await openFileCommand()

      expect(env.openExternal).toHaveBeenCalled()
      expect(Uri.from).toHaveBeenCalledWith({
        scheme: 'https',
        authority: 'github.com',
        path: 'username/repo/blob/feature-branch/src/file.ts',
      })
    })

    it('defaults to main branch when git command fails', async () => {
      vi.mocked(workspace).workspaceFolders = [{ uri: { fsPath: '/test/path' } }] as any
      vi.mocked(execSync)
        .mockReturnValueOnce('git@github.com:username/repo.git\n')
        .mockImplementationOnce(() => {
          throw new Error('Git error')
        })
      vi.mocked(window).activeTextEditor = {
        document: { fileName: '/test/path/src/file.ts' },
      } as any
      vi.mocked(workspace.asRelativePath).mockReturnValue('src/file.ts')
      activate(mockContext)

      const openFileCommand = vi.mocked(commands.registerCommand).mock.calls[1][1]
      await openFileCommand()

      expect(Uri.from).toHaveBeenCalledWith({
        scheme: 'https',
        authority: 'github.com',
        path: 'username/repo/blob/main/src/file.ts',
      })
    })
  })
})
