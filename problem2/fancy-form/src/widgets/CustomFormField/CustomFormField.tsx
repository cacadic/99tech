import { FormControl, FormField, FormItem } from '@/shared/components/ui/form';
import type { FormSchemaData, FormValues } from '@/shared/schemas';
import CurrencyInput from 'react-currency-input-field';
import { useFormContext, type Path } from 'react-hook-form';

interface CustomFormFieldProps {
    name: Path<FormSchemaData>;
    className?: string;
    disabled?: boolean;
}

const CustomFormField = ({ name, className, disabled }: CustomFormFieldProps) => {
    const form = useFormContext<FormValues>();

    return (
        <div className={className}>
            <FormField
                name={name}
                control={form.control}
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <CurrencyInput
                                id={field.name}
                                name={field.name}
                                value={form.watch(name) ?? ""}
                                decimalsLimit={2}
                                className="flex w-full bg-transparent text-right text-2xl text-white ring-offset-background focus-visible:outline-none focus-visible:ring-0 light:text-blue-500"
                                onValueChange={(val) => {
                                    form.setValue(name, val ?? "", { shouldValidate: true });
                                }}
                                disabled={disabled}
                                autoComplete='off'
                                allowNegativeValue={false}
                                maxLength={10}
                            />
                        </FormControl>
                    </FormItem>
                )}
            />
        </div>
    );
};

export default CustomFormField;