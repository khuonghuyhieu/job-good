import { AppIcon } from '../../shared/ui/index.js';

interface RewardMediaProps {
  imageUrl: string | null;
  size?: 'card' | 'detail';
}

export function RewardMedia({ imageUrl, size = 'card' }: RewardMediaProps) {
  const iconSize = size === 'detail' ? 'size-16' : 'size-12';

  return imageUrl ? (
    <img
      className="-mx-6 -mt-6 aspect-[16/10] w-[calc(100%+3rem)] object-cover"
      src={imageUrl}
      alt=""
    />
  ) : (
    <div className="-mx-6 -mt-6 grid aspect-[16/10] w-[calc(100%+3rem)] place-items-center bg-gj-primary-100 text-gj-primary-700">
      <AppIcon name="rewards" className={iconSize} />
      <span className="sr-only">Reward image placeholder</span>
    </div>
  );
}
