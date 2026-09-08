import * as React from 'react';
import { useEffect, useState } from 'react';
import { Modal } from '@fluentui/react/lib/Modal';
import { IconButton } from '@fluentui/react/lib/Button';
import { Persona, PersonaSize } from '@fluentui/react/lib/Persona';
import { Spinner, SpinnerSize } from '@fluentui/react/lib/Spinner';
import * as strings from 'CompetencyMatrixWebPartStrings';
import styles from './CompetencyMatrix.module.scss';
import { IPersonMatch, IUserProfile, PersonRole } from '../models';
import { ProfileService } from '../services/ProfileService';

export interface IPersonDetailsModalProps {
  match: IPersonMatch;
  profileService: ProfileService;
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
  profileService,
  accentForTitle,
  onDismiss
}) => {
  const { person, entries, startDate } = match;
  const [profile, setProfile] = useState<IUserProfile | undefined>(undefined);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [showAll, setShowAll] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingProfile(true);
    setShowAll(false);
    profileService
      .getProfile(person)
      .then((loaded) => {
        if (!cancelled) {
          setProfile(loaded);
          setLoadingProfile(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [profileService, person]);

  const leadOf = entries.filter((entry) => entry.role === 'lead');
  const managerOf = entries.filter((entry) => entry.role === 'manager');
  const memberOf = entries.filter((entry) => entry.role === 'member');

  const renderRow = (label: string, value?: string, href?: string): React.ReactNode => {
    if (!value) {
      return undefined;
    }
    return (
      <div className={styles.detailRow} key={label}>
        <span className={styles.detailLabel}>{label}</span>
        <span className={styles.detailValue}>
          {href ? (
            <a href={href} className={styles.detailLink}>
              {value}
            </a>
          ) : (
            value
          )}
        </span>
      </div>
    );
  };

  const renderChipGroup = (label: string, group: typeof entries): React.ReactNode => {
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

  const hasAdditional = !!profile && profile.details.length > 0;

  return (
    <Modal
      isOpen={true}
      onDismiss={onDismiss}
      isBlocking={false}
      containerClassName={styles.modalContainer}
    >
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
        {profile && profile.jobTitle && <div className={styles.modalTitle}>{profile.jobTitle}</div>}
        {profile && profile.department && (
          <div className={styles.modalMeta}>{profile.department}</div>
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
        <div className={styles.modalGroup}>
          <div className={styles.modalGroupLabel}>{strings.ContactDetailsLabel}</div>
          {loadingProfile ? (
            <Spinner size={SpinnerSize.small} labelPosition="right" label={strings.LoadingProfileText} />
          ) : (
            <div className={styles.detailList}>
              {renderRow(strings.RankLabel, profile && profile.jobTitle)}
              {renderRow(
                strings.MobileLabel,
                profile && profile.mobilePhone,
                profile && profile.mobilePhone ? `tel:${profile.mobilePhone}` : undefined
              )}
              {renderRow(
                strings.WorkPhoneLabel,
                profile && profile.businessPhone,
                profile && profile.businessPhone ? `tel:${profile.businessPhone}` : undefined
              )}
              {renderRow(
                strings.EmailLabel,
                person.email,
                person.email ? `mailto:${person.email}` : undefined
              )}
              {renderRow(strings.OfficeLabel, profile && profile.officeLocation)}
              {renderRow(
                strings.MemberSinceLabel,
                startDate
                  ? startDate.toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })
                  : undefined
              )}
            </div>
          )}
        </div>

        {!loadingProfile && profile && profile.manager && (
          <div className={styles.modalGroup}>
            <div className={styles.modalGroupLabel}>{strings.ReportsToLabel}</div>
            <Persona
              text={profile.manager.name}
              secondaryText={profile.manager.jobTitle || profile.manager.email}
              size={PersonaSize.size40}
              imageUrl={
                profile.manager.email
                  ? `/_layouts/15/userphoto.aspx?size=S&accountname=${encodeURIComponent(
                      profile.manager.email
                    )}`
                  : undefined
              }
            />
          </div>
        )}

        {renderChipGroup(strings.ModalLeadOfLabel, leadOf)}
        {renderChipGroup(strings.ModalManagerOfLabel, managerOf)}
        {renderChipGroup(strings.ModalMemberOfLabel, memberOf)}
        {entries.length === 0 && (
          <div className={styles.modalEmpty}>{strings.NoCompetencyForPersonText}</div>
        )}

        {!loadingProfile && hasAdditional && (
          <div className={styles.modalGroup}>
            <button
              type="button"
              className={styles.disclosure}
              aria-expanded={showAll}
              onClick={() => setShowAll((current) => !current)}
            >
              <span className={styles.disclosureChevron}>{showAll ? '▾' : '▸'}</span>
              {showAll ? strings.HideAdditionalDetailsText : strings.ShowAdditionalDetailsText}
            </button>
            {showAll && (
              <div className={styles.detailList}>
                {profile.details.map((detail) => renderRow(detail.label, detail.value))}
                <div className={styles.detailSource}>
                  {profile.source === 'graph'
                    ? strings.ProfileSourceGraphText
                    : strings.ProfileSourceSharePointText}
                </div>
              </div>
            )}
          </div>
        )}

        {!loadingProfile && profile && profile.source === 'none' && (
          <div className={styles.detailSource}>{strings.ProfileUnavailableText}</div>
        )}
      </div>
    </Modal>
  );
};

export default PersonDetailsModal;
