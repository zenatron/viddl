type ProgressBarProps = {
  progress: number;
  stats: {
    speed: string;
    downloaded: string;
    total: string;
  };
};

export function ProgressBar({ progress, stats }: ProgressBarProps) {
  return (
    <div className="space-y-2">
      <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
        <div 
          className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-sm text-gray-600 dark:text-gray-400 flex justify-between">
        <span>{progress}% • {stats.downloaded} / {stats.total}</span>
        <span>{stats.speed}</span>
      </div>
    </div>
  );
} 