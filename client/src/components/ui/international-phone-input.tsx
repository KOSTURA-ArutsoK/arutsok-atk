import { PhoneInput, defaultCountries, parseCountry } from "react-international-phone";
import "react-international-phone/style.css";

interface InternationalPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  "data-testid"?: string;
}

const countries = defaultCountries.filter((country) => {
  const { iso2 } = parseCountry(country);
  return true;
});

export function InternationalPhoneInput({
  value,
  onChange,
  disabled,
  "data-testid": testId,
}: InternationalPhoneInputProps) {
  return (
    <div data-testid={testId}>
      <PhoneInput
        defaultCountry="sk"
        value={value}
        onChange={onChange}
        disabled={disabled}
        countries={countries}
        inputClassName="intl-phone-input-field"
        countrySelectorStyleProps={{
          buttonClassName: "intl-phone-country-btn",
        }}
      />
    </div>
  );
}
