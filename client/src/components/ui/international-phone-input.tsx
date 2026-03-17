import { PhoneInput, defaultCountries } from "react-international-phone";
import "react-international-phone/style.css";
import { normalizePhone } from "@/lib/utils";

interface InternationalPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  dialCode?: string;
  "data-testid"?: string;
}

const DIAL_CODE_TO_ISO2: Record<string, string> = {
  "421": "sk", "420": "cz", "48": "pl",  "49": "de",
  "43": "at",  "36": "hu",  "380": "ua", "7": "ru",
  "1": "us",   "44": "gb",  "33": "fr",  "39": "it",
  "34": "es",  "31": "nl",  "32": "be",  "41": "ch",
  "45": "dk",  "46": "se",  "47": "no",  "358": "fi",
  "351": "pt", "30": "gr",  "40": "ro",  "359": "bg",
  "385": "hr", "386": "si", "381": "rs", "90": "tr",
  "353": "ie", "354": "is", "371": "lv", "370": "lt",
  "372": "ee",
};

export function InternationalPhoneInput({
  value,
  onChange,
  disabled,
  dialCode,
  "data-testid": testId,
}: InternationalPhoneInputProps) {
  const cleanCode = dialCode?.replace(/^0+/, "") || "";
  const defaultCountry = DIAL_CODE_TO_ISO2[cleanCode] || "sk";

  const normalizedValue = normalizePhone(value) || value || "";

  const handleChange = (val: string) => {
    const normalized = normalizePhone(val);
    onChange(normalized || val);
  };

  return (
    <div data-testid={testId}>
      <PhoneInput
        defaultCountry={defaultCountry}
        value={normalizedValue}
        onChange={handleChange}
        disabled={disabled}
        countries={defaultCountries}
        inputClassName="intl-phone-input-field"
        countrySelectorStyleProps={{
          buttonClassName: "intl-phone-country-btn",
        }}
      />
    </div>
  );
}
