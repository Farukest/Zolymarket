import React, { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';

const cardVariants = cva(
  'rounded-xl border bg-white text-gray-950 shadow-sm',
  {
    variants: {
      variant: {
        default: 'border-gray-200',
        outline: 'border-2 border-gray-200',
        elevated: 'border-gray-200 shadow-lg',
        interactive: 'border-gray-200 hover:shadow-lg transition-shadow duration-200 cursor-pointer',
        success: 'border-green-200 bg-green-50',
        warning: 'border-yellow-200 bg-yellow-50',
        danger: 'border-red-200 bg-red-50',
        info: 'border-blue-200 bg-blue-50',
      },
      size: {
        sm: 'p-4',
        md: 'p-6',
        lg: 'p-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const Card = forwardRef(({
  className,
  variant,
  size,
  children,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn(cardVariants({ variant, size }), className)}
    {...props}
  >
    {children}
  </div>
));

Card.displayName = 'Card';

const CardHeader = forwardRef(({
  className,
  children,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn('flex flex-col space-y-1.5 pb-6', className)}
    {...props}
  >
    {children}
  </div>
));

CardHeader.displayName = 'CardHeader';

const CardTitle = forwardRef(({
  className,
  children,
  ...props
}, ref) => (
  <h3
    ref={ref}
    className={cn('text-2xl font-semibold leading-none tracking-tight', className)}
    {...props}
  >
    {children}
  </h3>
));

CardTitle.displayName = 'CardTitle';

const CardDescription = forwardRef(({
  className,
  children,
  ...props
}, ref) => (
  <p
    ref={ref}
    className={cn('text-sm text-gray-500', className)}
    {...props}
  >
    {children}
  </p>
));

CardDescription.displayName = 'CardDescription';

const CardContent = forwardRef(({
  className,
  children,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn('pt-0', className)}
    {...props}
  >
    {children}
  </div>
));

CardContent.displayName = 'CardContent';

const CardFooter = forwardRef(({
  className,
  children,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn('flex items-center pt-6', className)}
    {...props}
  >
    {children}
  </div>
));

CardFooter.displayName = 'CardFooter';

// Specialized card components
const StatsCard = forwardRef(({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  ...props
}, ref) => (
  <Card ref={ref} className={cn('', className)} {...props}>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            {trend && (
              <span className={cn(
                'text-sm font-medium',
                trend.startsWith('+') ? 'text-green-600' : 'text-red-600'
              )}>
                {trend}
              </span>
            )}
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
        {Icon && (
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Icon className="w-6 h-6 text-blue-600" />
          </div>
        )}
      </div>
    </CardContent>
  </Card>
));

StatsCard.displayName = 'StatsCard';

const FeatureCard = forwardRef(({
  title,
  description,
  icon: Icon,
  className,
  children,
  ...props
}, ref) => (
  <Card ref={ref} variant="interactive" className={cn('text-center', className)} {...props}>
    <CardContent className="p-6">
      {Icon && (
        <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-4">
          <Icon className="w-6 h-6 text-blue-600" />
        </div>
      )}
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-gray-600 mb-4">{description}</p>
      )}
      {children}
    </CardContent>
  </Card>
));

FeatureCard.displayName = 'FeatureCard';

const MetricCard = forwardRef(({
  label,
  value,
  change,
  changeType = 'neutral',
  icon: Icon,
  className,
  ...props
}, ref) => {
  const getChangeColor = () => {
    switch (changeType) {
      case 'positive':
        return 'text-green-600';
      case 'negative':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <Card ref={ref} className={cn('', className)} {...props}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">{label}</span>
          {Icon && <Icon className="w-4 h-4 text-gray-400" />}
        </div>
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-gray-900">{value}</span>
          {change && (
            <span className={cn('text-xs font-medium', getChangeColor())}>
              {change}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

MetricCard.displayName = 'MetricCard';

const GlassCard = forwardRef(({
  className,
  children,
  ...props
}, ref) => (
  <div
    ref={ref}
    className={cn(
      'backdrop-blur-md bg-white/10 border border-white/20 rounded-xl shadow-xl',
      className
    )}
    {...props}
  >
    {children}
  </div>
));

GlassCard.displayName = 'GlassCard';

const ImageCard = forwardRef(({
  src,
  alt,
  title,
  description,
  className,
  children,
  ...props
}, ref) => (
  <Card ref={ref} variant="interactive" className={cn('overflow-hidden', className)} {...props}>
    {src && (
      <div className="aspect-video bg-gray-200">
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
        />
      </div>
    )}
    <CardContent className="p-6">
      {title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-gray-600 mb-4">{description}</p>
      )}
      {children}
    </CardContent>
  </Card>
));

ImageCard.displayName = 'ImageCard';

export {
  Card,
  CardHeader,
  CardFooter,
  CardTitle,
  CardDescription,
  CardContent,
  StatsCard,
  FeatureCard,
  MetricCard,
  GlassCard,
  ImageCard,
};

export default Card;