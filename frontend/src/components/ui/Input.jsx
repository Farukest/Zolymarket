import React, { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { cn } from '../../utils/cn';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';

const inputVariants = cva(
  'flex w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'border-gray-300',
        error: 'border-red-300 text-red-900 placeholder:text-red-300 focus:ring-red-500 focus:border-red-500',
        success: 'border-green-300 text-green-900 placeholder:text-green-300 focus:ring-green-500 focus:border-green-500',
        warning: 'border-yellow-300 text-yellow-900 placeholder:text-yellow-300 focus:ring-yellow-500 focus:border-yellow-500',
      },
      size: {
        sm: 'h-8 px-2 text-xs',
        md: 'h-10 px-3 text-sm',
        lg: 'h-12 px-4 text-base',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
);

const Input = forwardRef(({
  className,
  variant,
  size,
  type = 'text',
  label,
  error,
  success,
  warning,
  helperText,
  required,
  icon: Icon,
  iconPosition = 'left',
  ...props
}, ref) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const inputType = type === 'password' && showPassword ? 'text' : type;
  
  // Determine variant based on validation state
  const currentVariant = error ? 'error' : success ? 'success' : warning ? 'warning' : variant;

  const InputComponent = (
    <div className="relative">
      {/* Left Icon */}
      {Icon && iconPosition === 'left' && (
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Icon className="h-4 w-4 text-gray-400" />
        </div>
      )}
      
      {/* Input Field */}
      <input
        type={inputType}
        className={cn(
          inputVariants({ variant: currentVariant, size }),
          Icon && iconPosition === 'left' && 'pl-10',
          Icon && iconPosition === 'right' && 'pr-10',
          type === 'password' && 'pr-10',
          className
        )}
        ref={ref}
        {...props}
      />
      
      {/* Right Icon */}
      {Icon && iconPosition === 'right' && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <Icon className="h-4 w-4 text-gray-400" />
        </div>
      )}
      
      {/* Password Toggle */}
      {type === 'password' && (
        <button
          type="button"
          className="absolute inset-y-0 right-0 pr-3 flex items-center"
          onClick={() => setShowPassword(!showPassword)}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          ) : (
            <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600" />
          )}
        </button>
      )}
      
      {/* Validation Icons */}
      {(error || success || warning) && !Icon && type !== 'password' && (
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          {error && <AlertCircle className="h-4 w-4 text-red-500" />}
          {success && <CheckCircle className="h-4 w-4 text-green-500" />}
          {warning && <AlertCircle className="h-4 w-4 text-yellow-500" />}
        </div>
      )}
    </div>
  );

  if (label || error || success || warning || helperText) {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        {InputComponent}
        {(error || success || warning || helperText) && (
          <div className="flex items-start gap-1">
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            {success && (
              <p className="text-sm text-green-600">{success}</p>
            )}
            {warning && (
              <p className="text-sm text-yellow-600">{warning}</p>
            )}
            {helperText && !error && !success && !warning && (
              <p className="text-sm text-gray-500">{helperText}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return InputComponent;
});

Input.displayName = 'Input';

// Specialized input components
export const SearchInput = forwardRef(({
  className,
  placeholder = 'Search...',
  ...props
}, ref) => {
  return (
    <Input
      ref={ref}
      type="search"
      placeholder={placeholder}
      icon={Search}
      iconPosition="left"
      className={cn('', className)}
      {...props}
    />
  );
});

SearchInput.displayName = 'SearchInput';

export const NumberInput = forwardRef(({
  min,
  max,
  step = 1,
  value,
  onChange,
  className,
  ...props
}, ref) => {
  const handleIncrement = () => {
    const currentValue = parseFloat(value) || 0;
    const newValue = currentValue + step;
    if (max === undefined || newValue <= max) {
      onChange && onChange({ target: { value: newValue.toString() } });
    }
  };

  const handleDecrement = () => {
    const currentValue = parseFloat(value) || 0;
    const newValue = currentValue - step;
    if (min === undefined || newValue >= min) {
      onChange && onChange({ target: { value: newValue.toString() } });
    }
  };

  return (
    <div className="relative">
      <Input
        ref={ref}
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className={cn('pr-16', className)}
        {...props}
      />
      <div className="absolute inset-y-0 right-0 flex flex-col">
        <button
          type="button"
          onClick={handleIncrement}
          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border-l border-gray-300"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={handleDecrement}
          className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 border-l border-t border-gray-300"
        >
          ▼
        </button>
      </div>
    </div>
  );
});

NumberInput.displayName = 'NumberInput';

export const TextArea = forwardRef(({
  className,
  label,
  error,
  success,
  warning,
  helperText,
  required,
  rows = 4,
  ...props
}, ref) => {
  const currentVariant = error ? 'error' : success ? 'success' : warning ? 'warning' : 'default';

  const TextAreaComponent = (
    <textarea
      className={cn(
        inputVariants({ variant: currentVariant }),
        'min-h-[80px] resize-vertical',
        className
      )}
      rows={rows}
      ref={ref}
      {...props}
    />
  );

  if (label || error || success || warning || helperText) {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        {TextAreaComponent}
        {(error || success || warning || helperText) && (
          <div className="flex items-start gap-1">
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            {success && (
              <p className="text-sm text-green-600">{success}</p>
            )}
            {warning && (
              <p className="text-sm text-yellow-600">{warning}</p>
            )}
            {helperText && !error && !success && !warning && (
              <p className="text-sm text-gray-500">{helperText}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return TextAreaComponent;
});

TextArea.displayName = 'TextArea';

export const Select = forwardRef(({
  className,
  children,
  label,
  error,
  success,
  warning,
  helperText,
  required,
  placeholder,
  ...props
}, ref) => {
  const currentVariant = error ? 'error' : success ? 'success' : warning ? 'warning' : 'default';

  const SelectComponent = (
    <select
      className={cn(
        inputVariants({ variant: currentVariant }),
        'cursor-pointer',
        className
      )}
      ref={ref}
      {...props}
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {children}
    </select>
  );

  if (label || error || success || warning || helperText) {
    return (
      <div className="space-y-1">
        {label && (
          <label className="block text-sm font-medium text-gray-700">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        {SelectComponent}
        {(error || success || warning || helperText) && (
          <div className="flex items-start gap-1">
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            {success && (
              <p className="text-sm text-green-600">{success}</p>
            )}
            {warning && (
              <p className="text-sm text-yellow-600">{warning}</p>
            )}
            {helperText && !error && !success && !warning && (
              <p className="text-sm text-gray-500">{helperText}</p>
            )}
          </div>
        )}
      </div>
    );
  }

  return SelectComponent;
});

Select.displayName = 'Select';

export const InputGroup = ({ children, className, ...props }) => {
  return (
    <div
      className={cn('flex rounded-lg shadow-sm', className)}
      {...props}
    >
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement(child)) {
          const isFirst = index === 0;
          const isLast = index === React.Children.count(children) - 1;
          
          return React.cloneElement(child, {
            className: cn(
              child.props.className,
              !isFirst && '-ml-px',
              isFirst && 'rounded-r-none',
              isLast && 'rounded-l-none',
              !isFirst && !isLast && 'rounded-none'
            ),
          });
        }
        return child;
      })}
    </div>
  );
};

InputGroup.displayName = 'InputGroup';

export default Input;