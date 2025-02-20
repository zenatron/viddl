import packageJson from '../../package.json';

export function Footer() {
  return (
    <footer className="row-start-3 flex gap-x-4 gap-y-1 flex-wrap items-center justify-center text-sm text-gray-600 dark:text-gray-400">
      <span>© {new Date().getFullYear()} viddl</span>
      <span>•</span>
      <span>For personal use only</span>
      <span>•</span>
      <span>Use responsibly</span>
      <span>•</span>
      <span>v{packageJson.version}</span>
    </footer>
  );
} 