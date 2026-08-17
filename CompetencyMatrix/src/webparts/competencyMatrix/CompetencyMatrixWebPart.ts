import * as React from 'react';
import * as ReactDom from 'react-dom';
import { Version } from '@microsoft/sp-core-library';
import {
  type IPropertyPaneConfiguration,
  PropertyPaneTextField
} from '@microsoft/sp-property-pane';
import { BaseClientSideWebPart } from '@microsoft/sp-webpart-base';
import type { IReadonlyTheme } from '@microsoft/sp-component-base';
import { spfi, SPFI, SPFx } from '@pnp/sp';

import * as strings from 'CompetencyMatrixWebPartStrings';
import CompetencyMatrix from './components/CompetencyMatrix';
import type { ICompetencyMatrixProps } from './components/ICompetencyMatrixProps';
import { CompetencyService } from './services/CompetencyService';

export interface ICompetencyMatrixWebPartProps {
  title: string;
  competenciesListTitle: string;
  leadField: string;
  competencyDescriptionField: string;
  staffListTitle: string;
  staffPersonField: string;
  competencyLookupField: string;
}

export default class CompetencyMatrixWebPart extends BaseClientSideWebPart<ICompetencyMatrixWebPartProps> {
  private _sp: SPFI;
  private _isDarkTheme: boolean = false;

  protected async onInit(): Promise<void> {
    await super.onInit();
    this._sp = spfi().using(SPFx(this.context));
  }

  public render(): void {
    const service = new CompetencyService(this._sp, {
      competenciesListTitle: this.properties.competenciesListTitle || 'Competencies',
      leadField: this.properties.leadField || 'Lead',
      competencyDescriptionField: this.properties.competencyDescriptionField,
      staffListTitle: this.properties.staffListTitle || 'Team Structure',
      staffPersonField: this.properties.staffPersonField || 'Resource',
      competencyLookupField: this.properties.competencyLookupField || 'Competency'
    });

    const element: React.ReactElement<ICompetencyMatrixProps> = React.createElement(CompetencyMatrix, {
      title: this.properties.title,
      service: service,
      isDarkTheme: this._isDarkTheme
    });

    ReactDom.render(element, this.domElement);
  }

  protected onDispose(): void {
    ReactDom.unmountComponentAtNode(this.domElement);
  }

  protected onThemeChanged(currentTheme: IReadonlyTheme | undefined): void {
    if (!currentTheme) {
      return;
    }

    this._isDarkTheme = !!currentTheme.isInverted;
    const { semanticColors } = currentTheme;

    if (semanticColors) {
      this.domElement.style.setProperty('--bodyText', semanticColors.bodyText || null);
      this.domElement.style.setProperty('--link', semanticColors.link || null);
      this.domElement.style.setProperty('--linkHovered', semanticColors.linkHovered || null);
    }
  }

  protected get dataVersion(): Version {
    return Version.parse('1.0');
  }

  protected getPropertyPaneConfiguration(): IPropertyPaneConfiguration {
    return {
      pages: [
        {
          header: {
            description: strings.PropertyPaneDescription
          },
          groups: [
            {
              groupName: strings.GeneralGroupName,
              groupFields: [
                PropertyPaneTextField('title', {
                  label: strings.TitleFieldLabel
                })
              ]
            },
            {
              groupName: strings.CompetenciesGroupName,
              groupFields: [
                PropertyPaneTextField('competenciesListTitle', {
                  label: strings.CompetenciesListFieldLabel
                }),
                PropertyPaneTextField('leadField', {
                  label: strings.LeadFieldLabel
                }),
                PropertyPaneTextField('competencyDescriptionField', {
                  label: strings.CompetencyDescriptionFieldLabel,
                  description: strings.OptionalFieldDescription
                })
              ]
            },
            {
              groupName: strings.StaffGroupName,
              groupFields: [
                PropertyPaneTextField('staffListTitle', {
                  label: strings.StaffListFieldLabel
                }),
                PropertyPaneTextField('staffPersonField', {
                  label: strings.StaffPersonFieldLabel
                }),
                PropertyPaneTextField('competencyLookupField', {
                  label: strings.CompetencyLookupFieldLabel
                })
              ]
            }
          ]
        }
      ]
    };
  }
}
