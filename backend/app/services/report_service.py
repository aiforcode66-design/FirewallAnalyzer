"""Report Generation Service."""
import csv
import io
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

class ReportService:
    @staticmethod
    def generate_csv(analysis):
        """Generate CSV report for analysis findings."""
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Header
        writer.writerow(['Analysis Report'])
        writer.writerow(['Device', analysis.device.name])
        writer.writerow(['Date', analysis.timestamp])
        writer.writerow([])
        
        writer.writerow(['Severity', 'Type', 'Message', 'Recommendation'])
        
        # Rows
        for finding in analysis.findings:
            writer.writerow([
                finding.severity, 
                finding.type, 
                finding.message, 
                finding.recommendation
            ])
            
        return output.getvalue()

    @staticmethod
    def generate_pdf(analysis):
        """Generate PDF report."""
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        elements = []
        styles = getSampleStyleSheet()
        
        # Custom Style
        title_style = styles['Title']
        heading_style = styles['Heading2']
        normal_style = styles['Normal']
        
        # Title
        elements.append(Paragraph("Firewall Analysis Report", title_style))
        elements.append(Spacer(1, 12))
        
        # Metadata
        elements.append(Paragraph(f"<b>Device Name:</b> {analysis.device.name}", normal_style))
        elements.append(Paragraph(f"<b>IP Address:</b> {analysis.device.ip_address}", normal_style))
        elements.append(Paragraph(f"<b>Date:</b> {analysis.timestamp.strftime('%Y-%m-%d %H:%M:%S')}", normal_style))
        elements.append(Spacer(1, 24))
        
        # Executive Summary
        elements.append(Paragraph("Executive Summary", heading_style))
        summary_data = [
            ['Metric', 'Count'],
            ['Total Rules', analysis.summary.get('totalRules', 0)],
            ['High Risk', analysis.summary.get('highRiskRules', 0)],
            ['Redundant', analysis.summary.get('redundantRules', 0)],
            ['Shadowed', analysis.summary.get('shadowedRules', 0)],
            ['Optimization Score', f"{analysis.summary.get('score', 0)}/100"]
        ]
        
        t_summary = Table(summary_data, colWidths=[200, 100])
        t_summary.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#049fd9')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('GRID', (0, 0), (-1, -1), 1, colors.grey)
        ]))
        elements.append(t_summary)
        elements.append(Spacer(1, 24))
        
        # Detailed Findings
        elements.append(Paragraph("Detailed Findings", heading_style))
        
        if analysis.findings:
            data = [['Severity', 'Type', 'Issue', 'Recommendation']]
            for f in analysis.findings:
                # Wrap text? Table handles mostly, but cleaner to limit length or use Paragraph in cell
                data.append([
                    f.severity.upper(),
                    f.type,
                    Paragraph(f.message, normal_style),
                    Paragraph(f.recommendation, normal_style)
                ])
                
            t_findings = Table(data, colWidths=[60, 60, 190, 190], repeatRows=1)
            t_findings.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#333333')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('FONTSIZE', (0, 0), (-1, -1), 9),
            ]))
            elements.append(t_findings)
        else:
            elements.append(Paragraph("No issues found.", normal_style))
            
        doc.build(elements)
        buffer.seek(0)
        return buffer
