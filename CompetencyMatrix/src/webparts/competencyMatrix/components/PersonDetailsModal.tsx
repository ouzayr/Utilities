import * as React from 'react';
import { Modal } from '@fluentui/react/lib/Modal';
import { IconButton } from '@fluentui/react/lib/Button';
import { Persona, PersonaSize } from '@fluentui/react/lib/Persona';
import * as strings from 'CompetencyMatrixWebPartStrings';
import styles from './CompetencyMatrix.module.scss';
import { IPersonMatch, PersonRole } from '../models';

export interface IPersonDetailsModalProps {
  match: IPersonMatch;
  /** Accent color per competency title, so chips match their cards. */
  accentForTitle: (title: string) => string;
  onDismiss: () => void;
}

export const roleLabel = (role: PersonRole): string => {
  if (role === 'lead') {
    return strings.RoleLeadLabel;
  }
  if (role === 'manager') {
    return strings.RoleManagerLabel;
  }
  return strings.RoleMemberLabel;
};

/** SharePoint serves profile photos in S/M/L; L is used for the large modal image. */
export const largePhotoUrl = (email?: string): string | undefined =>
  email ? `/_layouts/15/userphoto.aspx?size=L&accountname=${encodeURIComponent(email)}` : undefined;

const PersonDetailsModal: React.FunctionComponent<IPersonDetailsModalProps> = ({
  match,
  accentForTitle,
  onDismiss
}) => {
  const { person, entries, startDate } = match;
  const leadOf = entries.filter((entry) => entry.role === 'lead');
  const managerOf = entries.filter((entry) => entry.role === 'manager');
  const memberOf = entries.filter((entry) => entry.role === 'member');

  const renderGroup = (label: string, group: typeof entries): React.ReactNode => {
    if (group.length === 0) {
      return undefined;
    }
    return (
      <div className={styles.modalGroup}>
        <div className={styles.modalGroupLabel}>{label}</div>
        <div className={styles.modalChips}>
          {group.map((entry) => (
            <span key={`${entry.role}-${entry.competencyId}`} className={styles.modalChip}>
              <span
                className={styles.chipDot}
                style={{ backgroundColor: accentForTitle(entry.title) }}
              />
              {entry.title}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={true} onDismiss={onDismiss} isBlocking={false} containerClassName={styles.modalContainer}>
      <div className={styles.modalHeader}>
        <IconButton
          className={styles.modalClose}
          iconProps={{ iconName: 'Cancel' }}
          ariaLabel={strings.CloseButtonText}
          onClick={onDismiss}
        />
      </div>

      <div className={styles.modalIdentity}>
        <Persona
          size={PersonaSize.size120}
          text={person.name}
          imageUrl={largePhotoUrl(person.email)}
          hidePersonaDetails={true}
          className={styles.modalPhoto}
        />
        <h2 className={styles.modalName}>{person.name}</h2>
        {person.email && (
          <a className={styles.modalEmail} href={`mailto:${person.email}`}>
            {person.email}
          </a>
        )}
        {startDate && (
          <div className={styles.modalMeta}>
            {strings.MemberSinceLabel}{' '}
            {startDate.toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'long',
              year: 'numeric'
            })}
          </div>
        )}
      </div>

      {person.email && (
        <div className={styles.modalActions}>
          <a
            className={styles.modalAction}
            href={`https://teams.microsoft.com/l/chat/0/0?users=${encodeURIComponent(person.email)}`}
            target="_blank"
            rel="noreferrer"
          >
            {strings.ChatInTeamsText}
          </a>
          <a className={styles.modalAction} href={`mailto:${person.email}`}>
            {strings.SendEmailText}
          </a>
        </div>
      )}

      <div className={styles.modalBody}>
        {entries.length === 0 ? (
          <div className={styles.modalEmpty}>{strings.NoCompetencyForPersonText}</div>
        ) : (
          <>
            {renderGroup(strings.ModalLeadOfLabel, leadOf)}
            {renderGroup(strings.ModalManagerOfLabel, managerOf)}
            {renderGroup(strings.ModalMemberOfLabel, memberOf)}
          </>
        )}
      </div>
    </Modal>
  );
};

export default PersonDetailsModal;
