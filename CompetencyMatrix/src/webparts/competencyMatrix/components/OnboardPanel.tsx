import * as React from 'react';
import { useState } from 'react';
import { Panel, PanelType } from '@fluentui/react/lib/Panel';
import { NormalPeoplePicker } from '@fluentui/react/lib/Pickers';
import type { IPersonaProps } from '@fluentui/react/lib/Persona';
import { DatePicker } from '@fluentui/react/lib/DatePicker';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import * as strings from 'CompetencyMatrixWebPartStrings';
import styles from './CompetencyMatrix.module.scss';
import { CompetencyService } from '../services/CompetencyService';
import { ICompetency, IPersonSuggestion } from '../models';

export interface IOnboardPanelProps {
  service: CompetencyService;
  competencies: ICompetency[];
  onDismiss: () => void;
  onSuccess: (message: string) => void;
}

interface IPickerPersona extends IPersonaProps {
  data: IPersonSuggestion;
}

const OnboardPanel: React.FunctionComponent<IOnboardPanelProps> = ({
  service,
  competencies,
  onDismiss,
  onSuccess
}) => {
  const [selectedPeople, setSelectedPeople] = useState<IPickerPersona[]>([]);
  const [selectedCompetencyIds, setSelectedCompetencyIds] = useState<number[]>([]);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const resolveSuggestions = async (filter: string): Promise<IPersonaProps[]> => {
    if (!filter || filter.trim().length < 2) {
      return [];
    }
    try {
      const suggestions = await service.searchPeople(filter.trim());
      return suggestions.map((suggestion): IPickerPersona => ({
        key: suggestion.loginName,
        text: suggestion.name,
        secondaryText: suggestion.email,
        data: suggestion
      }));
    } catch {
      return [];
    }
  };

  const competencyOptions: IDropdownOption[] = competencies.map((competency) => ({
    key: competency.id,
    text: competency.title
  }));

  const onCompetencyChange = (_: unknown, option?: IDropdownOption): void => {
    if (!option) {
      return;
    }
    const id = option.key as number;
    setSelectedCompetencyIds((current) =>
      option.selected ? current.concat([id]) : current.filter((value) => value !== id)
    );
  };

  const submit = async (): Promise<void> => {
    const person = selectedPeople.length > 0 ? selectedPeople[0].data : undefined;
    if (!person || selectedCompetencyIds.length === 0) {
      setError(strings.OnboardMissingFieldsText);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await service.onboardStaff(person.loginName, selectedCompetencyIds, startDate);
      onSuccess(strings.OnboardSuccessText.replace('{0}', person.name));
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(`${strings.ActionErrorText} ${message}`);
      setSaving(false);
    }
  };

  return (
    <Panel
      isOpen={true}
      type={PanelType.custom}
      customWidth="420px"
      headerText={strings.OnboardPanelTitle}
      onDismiss={saving ? undefined : onDismiss}
      isLightDismiss={!saving}
      onRenderFooterContent={() => (
        <div className={styles.panelFooter}>
          <PrimaryButton
            text={saving ? strings.SavingText : strings.OnboardSubmitText}
            onClick={submit}
            disabled={saving}
          />
          <DefaultButton text={strings.CancelButtonText} onClick={onDismiss} disabled={saving} />
        </div>
      )}
      isFooterAtBottom={true}
    >
      <div className={styles.panelBody}>
        {error && (
          <MessageBar messageBarType={MessageBarType.error} isMultiline={true}>
            {error}
          </MessageBar>
        )}

        <div>
          <label className={styles.panelLabel}>{strings.PersonPickerLabel}</label>
          <NormalPeoplePicker
            onResolveSuggestions={resolveSuggestions}
            selectedItems={selectedPeople}
            onChange={(items) => setSelectedPeople(((items || []) as IPickerPersona[]).slice(-1))}
            itemLimit={1}
            resolveDelay={300}
            disabled={saving}
            pickerSuggestionsProps={{
              suggestionsHeaderText: strings.PeopleSuggestionsHeaderText,
              noResultsFoundText: strings.NoPeopleFoundText,
              loadingText: strings.LoadingText
            }}
          />
        </div>

        <Dropdown
          label={strings.CompetenciesPickerLabel}
          placeholder={strings.CompetenciesPickerPlaceholder}
          multiSelect={true}
          options={competencyOptions}
          selectedKeys={selectedCompetencyIds}
          onChange={onCompetencyChange}
          disabled={saving}
        />

        <DatePicker
          label={strings.StartDateLabel}
          value={startDate}
          onSelectDate={(date) => date && setStartDate(date)}
          disabled={saving}
        />

        <div className={styles.panelHint}>{strings.OnboardHintText}</div>
      </div>
    </Panel>
  );
};

export default OnboardPanel;
