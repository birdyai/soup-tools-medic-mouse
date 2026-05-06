// New table-based display for Database page
function displayRulesAsTable() {
    const container = document.querySelector('#database-page .conditions-grid');
    if (!container) return;
    
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;
    
    // Create table structure
    let tableHTML = `
        <table class="conditions-table">
            <thead>
                <tr>
                    <th width="40%">Condition Name</th>
                    <th width="25%">Type</th>
                    <th width="35%">Outcome</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    Object.entries(rulesData.conditions || {}).forEach(([conditionKey, condition]) => {
        // Apply filters
        if (searchTerm && !conditionKey.includes(searchTerm)) return;
        if (typeFilter && condition.type !== typeFilter) return;
        
        const conditionName = conditionKey.replace(/-/g, ' ');
        const isGlobal = condition.type === 'global';
        const typeDisplay = isGlobal ? 'Global Rule' : 'Clinic Specific';
        
        // Determine outcome display
        let outcomeDisplay = '';
        if (isGlobal) {
            // Map status to user-friendly text
            switch(condition.status) {
                case 'complete no':
                    outcomeDisplay = "Can't Have Treatment";
                    break;
                case 'yes':
                    outcomeDisplay = condition.exceptions ? 'Yes with Exceptions' : 'Yes';
                    break;
                case 'yes with doctor\'s note':
                    outcomeDisplay = 'Yes with Doctor Note';
                    break;
                default:
                    outcomeDisplay = 'Unknown';
            }
        } else {
            outcomeDisplay = 'Check Clinic';
        }
        
        // Main row
        tableHTML += `
            <tr class="condition-row ${isGlobal ? '' : 'expandable'}" data-condition="${conditionKey}">
                <td class="condition-name-cell">
                    ${!isGlobal ? '<span class="expand-icon">▶</span>' : ''}
                    <span class="condition-name">${conditionName}</span>
                </td>
                <td>
                    <span class="type-badge ${isGlobal ? 'type-global' : 'type-clinic'}">${typeDisplay}</span>
                </td>
                <td>
                    <span class="outcome-badge outcome-${outcomeDisplay.toLowerCase().replace(/[' ]/g, '-')}">${outcomeDisplay}</span>
                </td>
            </tr>
        `;
        
        // Expandable section for clinic-specific conditions
        if (!isGlobal) {
            tableHTML += `
                <tr class="clinic-details" data-condition="${conditionKey}" style="display: none;">
                    <td colspan="3" class="clinic-details-cell">
                        <div class="clinics-table-container">
                            <table class="clinics-table">
                                <thead>
                                    <tr>
                                        <th>Clinic</th>
                                        <th>Outcome</th>
                                        <th>Requirements</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;
            
            rulesData.clinics.forEach(clinicKey => {
                const clinicData = condition.clinics[clinicKey] || { status: 'unknown', requirements: [] };
                const clinicName = clinicKey.replace(/-/g, ' ');
                
                let clinicOutcome = '';
                switch(clinicData.status) {
                    case 'complete no':
                        clinicOutcome = "Can't Have Treatment";
                        break;
                    case 'yes':
                        clinicOutcome = 'Yes';
                        break;
                    case 'yes with doctor\'s note':
                        clinicOutcome = 'Yes with Doctor Note';
                        break;
                    default:
                        clinicOutcome = 'Unknown';
                }
                
                tableHTML += `
                    <tr>
                        <td class="clinic-name">${clinicName}</td>
                        <td>
                            <span class="outcome-badge outcome-${clinicOutcome.toLowerCase().replace(/[' ]/g, '-')}">${clinicOutcome}</span>
                        </td>
                        <td class="requirements-cell">
                            ${clinicData.requirements && clinicData.requirements.length > 0 
                                ? clinicData.requirements.map(req => `<span class="requirement-tag">${req}</span>`).join(' ')
                                : '<span class="no-requirements">No specific requirements</span>'
                            }
                        </td>
                    </tr>
                `;
            });
            
            tableHTML += `
                                </tbody>
                            </table>
                        </div>
                    </td>
                </tr>
            `;
        }
    });
    
    tableHTML += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = tableHTML;
    
    // Add click handlers for expandable rows
    document.querySelectorAll('.condition-row.expandable').forEach(row => {
        row.addEventListener('click', function() {
            const conditionKey = this.dataset.condition;
            const detailsRow = document.querySelector(`.clinic-details[data-condition="${conditionKey}"]`);
            const expandIcon = this.querySelector('.expand-icon');
            
            if (detailsRow.style.display === 'none') {
                detailsRow.style.display = 'table-row';
                expandIcon.textContent = '▼';
                this.classList.add('expanded');
            } else {
                detailsRow.style.display = 'none';
                expandIcon.textContent = '▶';
                this.classList.remove('expanded');
            }
        });
    });
}

// Update the displayRules function to use the new table display
window.displayRules = displayRulesAsTable;