import * as React from 'react';
import { useMemo, useState } from 'react';
import { Panel, PanelType } from '@fluentui/react/lib/Panel';
import { DatePicker } from '@fluentui/react/lib/DatePicker';
import { Dropdown, IDropdownOption } from '@fluentui/react/lib/Dropdown';
import { PrimaryButton, DefaultButton } from '@fluentui/react/lib/Button';
import { MessageBar, MessageBarType } from '@fluentui/react/lib/MessageBar';
import * as strings from 'CompetencyMatrixWebPartStrings';
import styles from './CompetencyMatrix.module.scss';
import { CompetencyService } from '../services/CompetencyService';
import { IStaffMember } from '../models';

export interface IOffboardPanelProps {
  service: CompetencyService;
  /** Active staff items - one person can have several (one per competency). */
  staff: IStaffMember[];
  onDismiss: () => void;
  onSuccess: (message: string) => void;
}

const personKeyOf = (member: IStaffMember): string =>
  (member.person.email || member.person.name).toLowerCase();

const OffboardPanel: React.FunctionComponent<IOffboardPanelProps> = ({
  service,
  staff,
  onDismiss,
  onSuccess
}) => {
  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const personOptions = useMemo((): IDropdownOption[] => {
    const seen: { [key: string]: boolean } = {};
    const options: IDropdownOption[] = [];
    staff.forEach((member) => {
      const key = personKeyOf(member);
      if (!seen[key]) {
        seen[key] = true;
        options.push({ key, text: member.person.name });
      }
    });
    return options.sort((a, b) => a.text.localeCompare(b.text));
  }, [staff]);

  const selectedItems = useMemo(
    (): IStaffMember[] =>
      selectedKey ? staff.filter((member) => personKeyOf(member) === selectedKey) : [],
    [staff, selectedKey]
  );

  const affectedCompetencies = useMemo((): string[] => {
    const seen: { [title: string]: boolean } = {};
    const titles: string[] = [];
    selectedItems.forEach((member) =>
      member.competencies.forEach((competency) => {
        if (!seen[competency.title]) {
          seen[competency.title] = true;
          titles.push(competency.title);
        }
      })
    );
    return titles;
  }, [selectedItems]);

  const submit = async (): Promise<void> => {
    if (selectedItems.length === 0) {
      setError(strings.OffboardMissingFieldsText);
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await service.offboardStaff(selectedItems.map((member) => member.id), endDate);
      onSuccess(strings.OffboardSuccessText.replace('{0}', selectedItems[0].person.name));
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
      headerText={strings.OffboardPanelTitle}
      onDismiss={saving ? undefined : onDismiss}
      isLightDismiss={!saving}
      onRenderFooterContent={() => (
        <div className={styles.panelFooter}>
          <PrimaryButton
            text={saving ? strings.SavingText : strings.OffboardSubmitText}
            onClick={submit}
            disabled={saving || selectedItems.length === 0}
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

        {personOptions.length === 0 ? (
          <MessageBar messageBarType={MessageBarType.info}>{strings.NoStaffToOffboardText}</MessageBar>
        ) : (
          <>
            <Dropdown
              label={strings.OffboardPersonLabel}
              placeholder={strings.OffboardPersonPlaceholder}
              options={personOptions}
              selectedKey={selectedKey}
              onChange={(_, option) => option && setSelectedKey(option.key as string)}
              disabled={saving}
            />

            <DatePicker
              label={strings.EndDateLabel}
              value={endDate}
              onSelectDate={(date) => date && setEndDate(date)}
              disabled={saving}
            />

            {affectedCompetencies.length > 0 && (
              <div>
                <label className={styles.panelLabel}>{strings.OffboardAffectedLabel}</label>
                <div className={styles.panelChipRow}>
                  {affectedCompetencies.map((title) => (
                    <span key={title} className={styles.panelChip}>
                      {title}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.panelHint}>{strings.OffboardHintText}</div>
          </>
        )}
      </div>
    </Panel>
  );
};

export default OffboardPanel;
