// pages/api/generate-implementation-plan.js
import { callLLM } from '@/utils/llmClient';
import { configureApiKeysFromRequest } from '../../middleware/apiKeyMiddleware';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Configure API keys from request headers
        const apiKeys = configureApiKeysFromRequest(req, res);

        // Set environment variables for this request
        if (apiKeys.claudeApiKey) {
            process.env.ANTHROPIC_API_KEY = apiKeys.claudeApiKey;
        }
        if (apiKeys.openaiApiKey) {
            process.env.OPENAI_API_KEY = apiKeys.openaiApiKey;
        }

        // Use the configured provider preference
        const preferredProvider = apiKeys.provider;

        const { optimizedDocument, originalDocument, optimizationResults } = req.body;

        if (!optimizedDocument) {
            return res.status(400).json({ error: 'Missing optimized document data' });
        }

        console.log('Generating sectioned implementation plan...');

        // Generate implementation plan in sections
        const implementationPlan = await generateSectionedImplementationPlan(
            optimizedDocument,
            originalDocument,
            optimizationResults,
            preferredProvider
        );

        console.log('Sectioned implementation plan generation successful');

        return res.status(200).json({
            implementationPlan: implementationPlan.html,
            provider: implementationPlan.provider,
            sectionsGenerated: implementationPlan.sectionsGenerated
        });
    } catch (error) {
        console.error('Error generating implementation plan:', error);
        return res.status(500).json({
            error: 'Failed to generate implementation plan',
            message: error.message || 'An unexpected error occurred'
        });
    }
}

/**
 * Generate implementation plan in multiple sections to work within token limits
 */
async function generateSectionedImplementationPlan(optimizedDocument, originalDocument, optimizationResults, preferredProvider) {
    const baseContext = createBaseContext(optimizedDocument, originalDocument, optimizationResults);

    // Define sections to generate
    const sections = [
        {
            id: 'header-summary',
            title: 'Executive Summary & Project Overview',
            prompt: createHeaderSummaryPrompt(baseContext)
        },
        {
            id: 'scope-timeline',
            title: 'Project Scope & Implementation Timeline',
            prompt: createScopeTimelinePrompt(baseContext)
        },
        {
            id: 'stakeholders-resources',
            title: 'Stakeholder Analysis & Resource Requirements',
            prompt: createStakeholdersResourcesPrompt(baseContext)
        },
        {
            id: 'change-risks',
            title: 'Change Management & Risk Assessment',
            prompt: createChangeRisksPrompt(baseContext)
        },
        {
            id: 'metrics-governance',
            title: 'Success Metrics & Governance Framework',
            prompt: createMetricsGovernancePrompt(baseContext)
        },
        {
            id: 'action-support',
            title: 'Detailed Action Plan & Post-Implementation Support',
            prompt: createActionSupportPrompt(baseContext)
        }
    ];

    const sectionResults = [];
    let usedProvider = '';

    // Generate each section
    for (const section of sections) {
        try {
            console.log(`Generating section: ${section.title}`);

            const response = await callLLM({
                provider: preferredProvider !== 'both' ? preferredProvider : 'auto',
                temperature: 0.3,
                maxTokens: 8000, // Conservative limit for each section
                systemPrompt: "You are an implementation planning assistant. Generate ONLY the HTML content for the requested section (no DOCTYPE, html, head, or body tags). Use professional styling with classes that will be styled by the parent document. Focus on creating well-structured, actionable content.",
                userPrompt: section.prompt
            });

            sectionResults.push({
                id: section.id,
                title: section.title,
                content: response.content,
                provider: response.provider
            });

            usedProvider = response.provider;

            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
            console.error(`Error generating section ${section.id}:`, error);
            // Continue with other sections, but note the error
            sectionResults.push({
                id: section.id,
                title: section.title,
                content: `<div class="error-section"><h3>Error generating ${section.title}</h3><p>This section could not be generated due to: ${error.message}</p></div>`,
                provider: 'error'
            });
        }
    }

    // Combine all sections into a complete HTML document
    const completeHtml = combineHtmlSections(sectionResults);

    return {
        html: completeHtml,
        provider: usedProvider,
        sectionsGenerated: sectionResults.length
    };
}

/**
 * Create base context information for all sections
 */
function createBaseContext(optimizedDocument, originalDocument, optimizationResults) {
    const {
        summary = 'No summary available',
        suggestions = [],
        metrics = {},
        timeSavings = {},
        originalMetrics = {}
    } = optimizationResults || {};

    // Helper function to format time string (same as in ProcessOptimizer.jsx)
    const formatTimeString = (minutes) => {
        if (!minutes && minutes !== 0) {
            return "unknown";
        }

        if (minutes < 60) {
            return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
        } else if (minutes < 8 * 60) {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return remainingMinutes > 0
                ? `${hours} hour${hours !== 1 ? "s" : ""} ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""
                }`
                : `${hours} hour${hours !== 1 ? "s" : ""}`;
        } else {
            // Format in days when appropriate
            const days = Math.floor(minutes / (8 * 60));
            const remainingHours = Math.floor((minutes % (8 * 60)) / 60);
            const remainingMinutes = minutes % 60;

            let result = `${days} day${days !== 1 ? "s" : ""}`;

            if (remainingHours > 0) {
                result += ` ${remainingHours} hour${remainingHours !== 1 ? "s" : ""}`;
            }

            if (remainingMinutes > 0) {
                result += ` ${remainingMinutes} minute${remainingMinutes !== 1 ? "s" : ""
                    }`;
            }

            return result;
        }
    };

    // Extract comprehensive original metrics information
    const originalSteps = originalMetrics.totalSteps || 'Unknown';
    const originalTimeMinutes = originalMetrics.totalTimeMinutes;
    const originalTimeFormatted = originalMetrics.totalTime || (originalTimeMinutes ? formatTimeString(originalTimeMinutes) : 'Unknown');

    // Extract optimized metrics information
    const optimizedSteps = metrics.totalSteps || 'Unknown';
    const optimizedTimeMinutes = metrics.totalTimeMinutes;
    const optimizedTimeFormatted = metrics.totalTime || (optimizedTimeMinutes ? formatTimeString(optimizedTimeMinutes) : 'Unknown');

    // Calculate step reduction with proper handling
    let stepReduction = 'Process steps to be optimized';
    if (originalSteps !== 'Unknown' && optimizedSteps !== 'Unknown' && originalSteps > 0) {
        const stepDifference = originalSteps - optimizedSteps;
        const stepReductionPercent = Math.round((stepDifference / originalSteps) * 100);
        stepReduction = `${stepDifference} fewer steps (${stepReductionPercent}% reduction)`;
    }

    // Extract time savings information
    const timeSavingsFormatted = timeSavings.formatted || timeSavings.absolute || 'To be quantified';
    const timeSavingsPercent = timeSavings.percentageFormatted || timeSavings.percentage || 'TBD';

    // Extract additional process details
    const decisionPoints = originalMetrics.decisionPoints || 'Unknown';
    const approvalStages = originalMetrics.approvalStages || 'Unknown';
    const departmentsInvolved = originalMetrics.departmentsInvolved || 'Unknown';

    // Extract step-by-step details if available
    const originalStepTimes = originalMetrics.stepTimes || [];
    const optimizedStepTimes = metrics.stepTimes || [];

    // Create comprehensive suggestions summary
    const suggestionsText = suggestions.length > 0 ?
        suggestions.map((s, i) => `${i + 1}. ${s.title}: ${s.description}`).join('; ') :
        'No specific suggestions available';

    return {
        summary,
        suggestions,
        metrics,
        timeSavings,
        originalMetrics,

        // Formatted current process info
        currentSteps: originalSteps,
        currentTime: originalTimeFormatted,
        currentTimeMinutes: originalTimeMinutes,

        // Formatted optimized process info
        optimizedSteps: optimizedSteps,
        optimizedTime: optimizedTimeFormatted,
        optimizedTimeMinutes: optimizedTimeMinutes,

        // Calculated improvements
        stepReduction: stepReduction,
        timeSavingsFormatted: timeSavingsFormatted,
        timeSavingsPercent: timeSavingsPercent,

        // Additional process details
        decisionPoints: decisionPoints,
        approvalStages: approvalStages,
        departmentsInvolved: departmentsInvolved,

        // Step details
        originalStepTimes: originalStepTimes,
        optimizedStepTimes: optimizedStepTimes,

        // Summary text
        suggestionsText: suggestionsText,

        // Cost impact estimates
        costSavingsEstimate: timeSavings.costSavings || 'To be calculated based on time and resource efficiencies',

        // Quality improvements
        qualityImprovements: 'Enhanced accuracy and consistency expected',

        // Process complexity
        complexityReduction: originalSteps !== 'Unknown' && optimizedSteps !== 'Unknown' ?
            `Process complexity reduced from ${originalSteps} to ${optimizedSteps} steps` :
            'Process complexity to be analyzed'
    };
}

/**
 * Section 1: Header and Executive Summary
 */
function createHeaderSummaryPrompt(context) {
    return `Generate the header and executive summary section for an implementation plan.

CURRENT PROCESS DETAILS:
- Total Steps: ${context.currentSteps}
- Total Time: ${context.currentTime}
- Decision Points: ${context.decisionPoints}
- Approval Stages: ${context.approvalStages}
- Departments Involved: ${context.departmentsInvolved}

OPTIMIZED PROCESS DETAILS:
- Optimized Steps: ${context.optimizedSteps}
- Optimized Time: ${context.optimizedTime}
- Step Reduction: ${context.stepReduction}
- Time Savings: ${context.timeSavingsFormatted} (${context.timeSavingsPercent})
- Complexity Reduction: ${context.complexityReduction}

OPTIMIZATION SUMMARY:
${context.summary}

KEY IMPROVEMENTS:
${context.suggestionsText}

Generate HTML content for:
1. Main title "Implementation Plan for Process Optimization"
2. Executive Summary in a highlighted box covering:
   - Strategic rationale for this specific optimization
   - High-level transformation approach 
   - Key quantified benefits (${context.timeSavingsFormatted} time savings, ${context.stepReduction})
   - Expected ROI and cost savings: ${context.costSavingsEstimate}
   - Timeline summary (suggest 12-18 week implementation)
   - Critical success factors

3. Quick Wins Overview table showing immediate opportunities
4. Project Overview table with:
   - Current state metrics
   - Target state metrics  
   - Expected improvements
   - Implementation duration
   - Resource requirements estimate

Use professional CSS classes and make it visually appealing. Include the specific numbers provided above.`;
}

/**
 * Section 2: Scope and Timeline
 */
function createScopeTimelinePrompt(context) {
    return `Generate the project scope and timeline section for an implementation plan.

OPTIMIZATION CONTEXT:
- Current Process: ${context.currentSteps} steps taking ${context.currentTime}
- Target Process: ${context.optimizedSteps} steps taking ${context.optimizedTime}
- Expected Benefits: ${context.timeSavingsFormatted} time savings (${context.timeSavingsPercent})
- Process Complexity: ${context.complexityReduction}

SPECIFIC OPTIMIZATION AREAS:
${context.suggestionsText}

CURRENT PROCESS BREAKDOWN:
${context.originalStepTimes.length > 0 ?
            context.originalStepTimes.map(step => `- ${step.description}: ${step.time}`).join('\n') :
            'Step-by-step timing details to be analyzed during implementation'
        }

Generate HTML content for:

1. PROJECT SCOPE & OBJECTIVES
   - Primary Objectives (specific to this ${context.stepReduction} improvement)
   - Secondary Objectives (quality, compliance, user satisfaction)
   - Scope Boundaries table showing:
     * INCLUDED: Process steps being optimized, departments affected, systems involved
     * EXCLUDED: Out-of-scope processes, future enhancements, parallel initiatives
   - Success Criteria table with quantifiable measures:
     * Time reduction from ${context.currentTime} to ${context.optimizedTime}
     * Step reduction: ${context.stepReduction}
     * User adoption rate targets
     * Quality metrics
   - Critical Dependencies and Assumptions

2. IMPLEMENTATION TIMELINE (6 phases over 12-18 weeks)
   Create a comprehensive timeline table with columns:
   - Phase Name | Duration | Key Activities | Deliverables | Resources Required | Dependencies

   Include these phases:
   - Phase 1: Planning & Assessment (2-3 weeks)
   - Phase 2: System Setup & Configuration (2-3 weeks)  
   - Phase 3: Process Design & Training Development (3-4 weeks)
   - Phase 4: Pilot Implementation (2-3 weeks)
   - Phase 5: Full Rollout (2-3 weeks)
   - Phase 6: Optimization & Stabilization (2-3 weeks)

3. CRITICAL PATH ANALYSIS
   - Key milestones and decision gates
   - Risk mitigation buffer time
   - Go-live readiness criteria

Make it detailed and actionable with realistic timeframes for achieving the ${context.timeSavingsFormatted} improvement.`;
}

/**
 * Section 3: Stakeholders and Resources
 */
function createStakeholdersResourcesPrompt(context) {
    return `Generate the stakeholder analysis and resource requirements section.

PROCESS TRANSFORMATION CONTEXT:
- Current State: ${context.currentSteps} steps, ${context.currentTime}, ${context.departmentsInvolved} departments
- Future State: ${context.optimizedSteps} steps, ${context.optimizedTime}
- Impact: ${context.timeSavingsFormatted} time savings, ${context.stepReduction}
- Affected Areas: ${context.departmentsInvolved} departments, ${context.decisionPoints} decision points, ${context.approvalStages} approval stages

OPTIMIZATION FOCUS AREAS:
${context.suggestionsText}

Generate HTML content for:

1. STAKEHOLDER ANALYSIS
   Create comprehensive stakeholder tables:
   
   A) Primary Stakeholders Table:
   - Role/Department | Interest Level | Influence Level | Impact of Change | Engagement Strategy
   Include: Process owners, department managers, end users, IT support, compliance teams
   
   B) Secondary Stakeholders Table:
   - External partners, customers, vendors, regulatory bodies affected by the ${context.stepReduction}
   
   C) Communication Matrix:
   - Stakeholder Group | Key Messages | Communication Channel | Frequency | Responsible Party
   Focus on communicating the ${context.timeSavingsFormatted} benefit and process changes
   
   D) Influence/Interest Matrix:
   - High/Low Interest vs High/Low Influence grid
   - Engagement strategies for each quadrant

2. RESOURCE REQUIREMENTS

   A) Human Resources Table:
   - Role | Skills Required | Time Commitment | Internal/External | Estimated Cost | Duration
   Include: Project manager, process analysts, training coordinators, change champions, IT support
   
   B) Financial Resources Breakdown:
   - Category | Description | Estimated Cost | Timeline | ROI Impact
   Categories: Personnel, training, technology, external consultants, contingency
   Base estimates on achieving ${context.timeSavingsFormatted} savings
   
   C) Technology & Infrastructure Requirements:
   - System/Tool | Purpose | Cost Estimate | Implementation Timeline | Dependencies
   Focus on tools needed to support the optimized ${context.optimizedSteps}-step process

3. BUDGET SUMMARY
   - Total implementation cost estimate
   - Expected ROI timeline based on ${context.timeSavingsFormatted} annual savings
   - Cost-benefit analysis

Include realistic resource estimates for transforming from ${context.currentSteps} to ${context.optimizedSteps} steps across ${context.departmentsInvolved} departments.`;
}

/**
 * Section 4: Change Management and Risks
 */
function createChangeRisksPrompt(context) {
    return `Generate the change management and risk assessment section.

TRANSFORMATION SCOPE:
- Process Change: From ${context.currentSteps} steps (${context.currentTime}) to ${context.optimizedSteps} steps (${context.optimizedTime})
- Organizational Impact: ${context.departmentsInvolved} departments affected
- Key Changes: ${context.suggestionsText}
- Expected Benefits: ${context.timeSavingsFormatted} time savings (${context.timeSavingsPercent})

CURRENT PROCESS COMPLEXITY:
- Decision Points: ${context.decisionPoints}
- Approval Stages: ${context.approvalStages}
- Step Reduction: ${context.stepReduction}

Generate HTML content for:

1. CHANGE MANAGEMENT STRATEGY

   A) Organizational Readiness Assessment:
   - Current culture and change capacity
   - Historical change success factors
   - Readiness for ${context.stepReduction} process transformation
   
   B) Training Program Table:
   - Audience | Training Type | Duration | Delivery Method | Timeline | Success Metrics
   Focus on training for the new ${context.optimizedSteps}-step process
   
   C) Communication Plan:
   - Target Audience | Key Messages | Channel | Frequency | Responsible Party | Success Metrics
   Emphasize the ${context.timeSavingsFormatted} benefit and simplified process
   
   D) Resistance Management Strategy:
   - Potential resistance sources related to reducing ${context.stepReduction}
   - Impact assessment for each resistance source
   - Mitigation tactics and timelines
   - Change champion network

2. COMPREHENSIVE RISK ASSESSMENT

   Create a detailed risk register table with columns:
   - Risk ID | Risk Description | Category | Probability | Impact | Risk Score | Mitigation Strategy | Contingency Plan | Owner | Status

   Include these risk categories:
   
   A) Technical Risks:
   - System integration failures during process streamlining
   - Data migration issues
   - Performance problems with new ${context.optimizedSteps}-step workflow
   
   B) Organizational Risks:
   - User resistance to ${context.stepReduction} change
   - Skill gaps for new streamlined process
   - Loss of institutional knowledge
   - Department coordination challenges across ${context.departmentsInvolved} areas
   
   C) Process Risks:
   - Quality control gaps in simplified process
   - Compliance issues with reduced ${context.approvalStages} approval stages
   - Workflow bottlenecks in new ${context.optimizedSteps}-step process
   
   D) Timeline Risks:
   - Implementation delays affecting ${context.timeSavingsFormatted} realization
   - Resource availability conflicts
   - Dependency failures
   
   E) Financial Risks:
   - Budget overruns
   - ROI shortfalls from expected ${context.timeSavingsFormatted} savings
   - Unexpected costs during transition

3. RISK MITIGATION DASHBOARD
   - High-priority risks requiring immediate attention
   - Risk monitoring schedule and escalation procedures
   - Success criteria for risk reduction

Focus on realistic risks and practical mitigation strategies for this specific ${context.currentSteps}-to-${context.optimizedSteps} process transformation.`;
}

/**
 * Section 5: Metrics and Governance
 */
function createMetricsGovernancePrompt(context) {
    return `Generate the success metrics and governance framework section.

CONTEXT:
- Expected time savings: ${context.timeSavingsFormatted}
- Process improvements: ${context.stepReduction}

Generate HTML content for:
1. Success Metrics & KPIs
   - Metrics dashboard table (metric, baseline, target, measurement method)
   - Quantitative metrics (efficiency, time, cost, quality)
   - Qualitative indicators (satisfaction, adoption)
   - Reporting structure and frequency

2. Governance Framework
   - Project governance structure
   - Decision-making matrix
   - Quality assurance procedures
   - Issue escalation protocols
   - Change control processes

Include specific, measurable metrics tied to the optimization goals.`;
}

/**
 * Section 6: Action Plan and Support
 */
function createActionSupportPrompt(context) {
    return `Generate the detailed action plan and post-implementation support section.

CONTEXT:
- Implementation involves ${context.suggestions.length} key improvement areas
- Expected outcomes: ${context.timeSavingsFormatted} time savings

Generate HTML content for:
1. Detailed Action Plan
   - Phase-by-phase action items table
   - Task assignments with RACI matrix
   - Dependencies and timelines
   - Quality checkpoints

2. Post-Implementation Support
   - Transition planning (cutover, rollback, parallel run)
   - User support during transition
   - Sustainability measures
   - Continuous improvement mechanisms
   - Regular review cycles

3. Communication Plan
   - Stakeholder communication matrix
   - Message frameworks
   - Feedback mechanisms

Focus on specific, actionable tasks with clear ownership and timelines.`;
}

/**
 * Combine all HTML sections into a complete document
 */
function combineHtmlSections(sectionResults) {
    const sectionsHtml = sectionResults
        .map(section => `
            <!-- ${section.title} -->
            <section class="implementation-section" id="${section.id}">
                ${section.content}
            </section>
        `)
        .join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Implementation Plan</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background-color: #f8fafc;
            padding: 20px;
        }
        
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            padding: 40px;
        }
        
        .implementation-section {
            margin-bottom: 40px;
            padding-bottom: 30px;
            border-bottom: 2px solid #e5e7eb;
        }
        
        .implementation-section:last-child {
            border-bottom: none;
        }
        
        h1 {
            color: #1f2937;
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 25px;
            border-bottom: 4px solid #3b82f6;
            padding-bottom: 15px;
            text-align: center;
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        h2 {
            color: #1f2937;
            font-size: 24px;
            font-weight: 600;
            margin: 35px 0 20px 0;
            background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
            padding: 15px 20px;
            border-left: 5px solid #3b82f6;
            border-radius: 6px;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        }
        
        h3 {
            color: #374151;
            font-size: 20px;
            margin: 25px 0 12px 0;
            font-weight: 600;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 8px;
        }
        
        h4 {
            color: #4b5563;
            font-size: 18px;
            margin: 20px 0 10px 0;
            font-weight: 600;
        }
        
        p {
            margin-bottom: 12px;
            text-align: justify;
        }
        
        ul, ol {
            margin: 10px 0 15px 20px;
        }
        
        li {
            margin-bottom: 5px;
        }
        
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        th {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 12px;
            text-align: left;
            font-weight: 600;
            font-size: 14px;
        }
        
        td {
            padding: 12px;
            border-bottom: 1px solid #e5e7eb;
            vertical-align: top;
        }
        
        tr:nth-child(even) {
            background-color: #f9fafb;
        }
        
        tr:hover {
            background-color: #f3f4f6;
        }
        
        .executive-summary {
            background: linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%);
            border: 2px solid #10b981;
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        
        .executive-summary h2,
        .executive-summary h3 {
            color: #064e3b;
            margin-top: 0;
        }
        
        .risk-high {
            background-color: #fef2f2;
            border-left: 4px solid #ef4444;
            padding: 8px 12px;
            margin: 5px 0;
        }
        
        .risk-medium {
            background-color: #fefbeb;
            border-left: 4px solid #f59e0b;
            padding: 8px 12px;
            margin: 5px 0;
        }
        
        .risk-low {
            background-color: #f0fdf4;
            border-left: 4px solid #22c55e;
            padding: 8px 12px;
            margin: 5px 0;
        }
        
        .phase-box {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border: 1px solid #0ea5e9;
            border-radius: 8px;
            padding: 15px;
            margin: 15px 0;
        }
        
        .metric-box {
            background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
            border: 1px solid #16a34a;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
        }
        
        .warning-box {
            background: linear-gradient(135deg, #fefbeb 0%, #fef3c7 100%);
            border: 1px solid #d97706;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
        }
        
        .error-section {
            background: linear-gradient(135deg, #fef2f2 0%, #fecaca 100%);
            border: 1px solid #ef4444;
            border-radius: 8px;
            padding: 15px;
            margin: 10px 0;
        }
        
        .status-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }
        
        .status-not-started {
            background-color: #f3f4f6;
            color: #6b7280;
        }
        
        .status-in-progress {
            background-color: #dbeafe;
            color: #1d4ed8;
        }
        
        .status-completed {
            background-color: #dcfce7;
            color: #166534;
        }
        
        .priority-high {
            color: #dc2626;
            font-weight: 600;
        }
        
        .priority-medium {
            color: #d97706;
            font-weight: 600;
        }
        
        .priority-low {
            color: #059669;
            font-weight: 600;
        }
        
        .timeline-item {
            border-left: 3px solid #3b82f6;
            padding-left: 20px;
            margin: 15px 0;
            position: relative;
        }
        
        .timeline-item::before {
            content: '';
            position: absolute;
            left: -8px;
            top: 0;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background-color: #3b82f6;
        }
        
        @media print {
            body { 
                background: white; 
                padding: 0; 
            }
            .container { 
                box-shadow: none; 
                padding: 20px; 
            }
            h2 { 
                page-break-after: avoid; 
            }
            table { 
                page-break-inside: avoid; 
            }
        }
        
        @media (max-width: 768px) {
            .container {
                padding: 20px;
                margin: 10px;
            }
            
            table {
                font-size: 14px;
            }
            
            th, td {
                padding: 8px;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        ${sectionsHtml}
    </div>
</body>
</html>`;
}