export type GitProvider = 'github' | 'gitlab' | 'azure_devops' | 'bitbucket';

interface BuildGitWebUrlParams {
  gitWebUrl?: string;
  gitProvider?: GitProvider | string | null;
  defaultBranch?: string;
  path: string;
  targetType: 'file' | 'folder';
}

export function buildGitWebUrl({
  gitWebUrl,
  gitProvider,
  defaultBranch,
  path,
  targetType,
}: BuildGitWebUrlParams): string | null {
  if (!gitWebUrl || !defaultBranch) {
    return null;
  }

  if (gitProvider === 'gitlab') {
    return `${gitWebUrl}/-/${targetType === 'folder' ? 'tree' : 'blob'}/${defaultBranch}/${path}`;
  }

  if (gitProvider === 'azure_devops') {
    return `${gitWebUrl}?path=/${path}`;
  }

  if (gitProvider === 'bitbucket') {
    return `${gitWebUrl}/src/${defaultBranch}/${path}`;
  }

  return `${gitWebUrl}/${targetType === 'folder' ? 'tree' : 'blob'}/${defaultBranch}/${path}`;
}
