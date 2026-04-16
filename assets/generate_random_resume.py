import json
import random
import re
import urllib.request
from pathlib import Path
from fpdf import FPDF

source = Path('temp_resume.json')
if source.exists():
    with open(source, 'r', encoding='utf-8') as f:
        data = json.load(f)
else:
    url = 'https://raw.githubusercontent.com/jaani-builds/jaani-builds.github.io/main/data/resume.json'
    with urllib.request.urlopen(url, timeout=20) as response:
        data = json.load(response)

random.seed(42)
first_names = ['Ari', 'Mia', 'Noah', 'Data', 'Kai', 'Lara', 'Evan', 'Rhea', 'Nico', 'Isha']
last_names = ['Murphy', 'Chen', 'Patel', 'Osei', 'Nguyen', 'Reyes', 'Campbell', 'Das', 'Khan', 'Silva']
roles = ['Product Platform Lead', 'Technical Program Manager', 'Engineering Delivery Partner', 'Cloud Operations Lead', 'Platform Strategy Director']
locations = ['Singapore', 'Berlin, Germany', 'Toronto, Canada', 'Melbourne, Australia', 'Austin, TX']
emails = ['{handle}@example.com', '{handle}@prodmail.com', '{handle}@techmail.org']
phones = ['+65 8123 4567', '+1 512-555-0199', '+44 7700 900123', '+61 409 123 456', '+49 151 12345678']
public_domains = ['https://nova-portfolio.github.io', 'https://sparkfolio.github.io', 'https://protofolio.github.io']
companies = ['Nimbus Software', 'AeroScale', 'Helix Labs', 'Beacon Systems', 'Orbit Analytics', 'Atlas Cloud', 'Mosaic Ventures', 'Solstice Tech']
schools = ['National University', 'Imperial College', 'Monash University', 'KTH Royal Institute', 'University of Toronto', 'Nanyang Technological University']
degrees = ['Master of Science in Computer Science', 'MSc in Information Systems', 'Bachelor of Engineering in Software Engineering', 'BEng in Computer Science', 'MBA in Technology Management']
certs = ['Certified Scrum Product Owner', 'AWS Certified Solutions Architect', 'Google Cloud Digital Leader', 'Professional Scrum Master I', 'Microsoft Certified: Azure Fundamentals']
skills = {
    'Product Management': ['Roadmap Strategy', 'Stakeholder Alignment', 'User Story Mapping', 'Release Planning', 'Value Proposition', 'Market Research'],
    'Cloud & Platform Engineering': ['AWS', 'Kubernetes', 'Platform Automation', 'Infrastructure as Code', 'Observability', 'Service Reliability'],
    'Programming & Frameworks': ['Python', 'TypeScript', 'Node.js', 'React', 'GraphQL', 'Docker'],
    'Tools & Observability': ['Jira', 'Confluence', 'GitHub', 'Miro', 'Datadog', 'New Relic'],
    'Development Practices': ['CI/CD', 'DevSecOps', 'TDD', 'BDD', 'Microservices', 'API Design'],
    'Industry Expertise': ['Cloud Platforms', 'Digital Transformation', 'Platform Modernization', 'Security & Compliance', 'Customer Experience']
}
recommendation_roles = ['Engineering Lead', 'Product Strategy Partner', 'Delivery Manager', 'Operations Director', 'Senior Architect']
quotes = [
    'Delivers clear strategy across product, engineering, and business stakeholders with calm confidence.',
    'Transforms complex platform requirements into practical execution plans that accelerate delivery.',
    'Builds strong team momentum through structured planning, transparent communication, and technical credibility.',
    'Creates alignment across cross-functional teams while maintaining quality and velocity.',
    'Leads with pragmatism and a keen eye for customer-focused outcomes.'
]
experiment_names = ['Platform Builder', 'Data Flow Suite', 'Velocity Dashboard', 'Insight Engine', 'Launchpad Studio']
project_types = ['full-stack', 'platform', 'data-driven', 'developer tools']

def random_handle(name: str) -> str:
    handle = ''.join(re.findall('[a-z0-9]', name.lower().replace(' ', '')))
    if len(handle) < 5:
        handle += str(random.randint(1, 99))
    return handle

name = f"{random.choice(first_names)} {random.choice(last_names)}"
handle = random_handle(name)
role = random.choice(roles)
email = random.choice(emails).format(handle=handle)
phone = random.choice(phones)
location = random.choice(locations)
public = random.choice(public_domains)

new = data.copy()
new['basics'] = {
    'name': name,
    'role': role,
    'email': email,
    'phone': phone,
    'location': location,
    'linkedin': f'https://linkedin.com/in/{handle}/',
    'github': f'https://github.com/{handle}',
    'photoUrl': ''
}
new['meta'] = {
    'title': f'{name} | {role}',
    'description': f'{role} with extensive experience building cloud-native products, developer platforms, and delivery operations.'
}
new['publicUrl'] = public
new['summary'] = f'{role} with strong experience in enterprise platforms, cloud operations, and product delivery. Expert at aligning business goals with modern infrastructure and leading cross-functional teams to ship reliable software.'
new['pdfUrl'] = f'assets/resume/{name.replace(" ", "-")}-Resume.pdf'
new['recommendationsWidget'] = {
    'enabled': True,
    'provider': 'sociablekit',
    'widgetId': str(random.randint(20000000, 29999999)),
    'profileUrl': f'https://www.linkedin.com/in/{handle}/details/recommendations/'
}

entries = []
for i in range(4):
    company = random.choice(companies)
    title = random.choice(['Platform Lead', 'Cloud Engineer', 'Senior Software Architect', 'Product Delivery Manager', 'DevOps Engineer'])
    if i == 0:
        start = 'Jul 2024'
        end = 'Present'
        loc = location
    elif i == 1:
        start = 'Sep 2022'
        end = 'Jul 2024'
        loc = location
    elif i == 2:
        start = 'Feb 2017'
        end = 'Sep 2022'
        loc = location
    else:
        start = 'Oct 2013'
        end = 'Feb 2017'
        loc = 'India'
    highlights = [
        f'Led product and platform initiatives at {company} to improve developer efficiency and operational visibility.',
        'Drove cloud migration and automation efforts to reduce cycle time and strengthen security posture.',
        'Coordinated stakeholder reporting, roadmap planning, and delivery governance for multiple cross-functional teams.',
        'Built reusable infrastructure patterns and observability workflows to support high-growth launches.'
    ]
    random.shuffle(highlights)
    entries.append({
        'title': title,
        'company': company,
        'location': loc,
        'employmentType': 'Full-time',
        'start': start,
        'end': end,
        'highlights': highlights[:4]
    })
new['experience'] = entries

education = []
for i in range(2):
    education.append({
        'degree': random.choice(degrees),
        'school': random.choice(schools),
        'start': '2013' if i == 0 else '2009',
        'end': '2015' if i == 0 else '2013'
    })
new['education'] = education

recommendations = []
for _ in range(2):
    recommendations.append({
        'name': random.choice(['Engineering Stakeholder', 'Delivery Partner', 'Product Partner', 'Operations Lead', 'Platform Lead']),
        'role': random.choice(recommendation_roles),
        'quote': random.choice(quotes),
        'source': 'LinkedIn Recommendation',
        'linkedinUrl': f'https://www.linkedin.com/in/{handle}/details/recommendations/'
    })
new['recommendations'] = recommendations
recommendation_categories = {}
for rec in recommendations:
    category = rec.get('source', 'Recommendations')
    recommendation_categories.setdefault(category, []).append(rec)
new['recommendationCategories'] = recommendation_categories

experiments = []
for _ in range(2):
    name_exp = random.choice(experiment_names)
    tech_backend = random.sample(['FastAPI', 'Python', 'Terraform', 'AWS Lambda', 'Docker', 'Kubernetes'], 4)
    tech_frontend = random.sample(['Vanilla JS', 'HTML', 'CSS', 'React', 'GraphQL', 'Cloudflare Pages'], 4)
    experiments.append({
        'name': name_exp,
        'type': random.choice(project_types),
        'backend': {
            'tech': tech_backend,
            'highlights': [
                'Built a scalable backend with modern cloud-native tooling.',
                'Designed secure API contracts and reusable architecture patterns.'
            ],
            'links': [
                {'label': 'Backend Repo', 'url': f'https://github.com/{handle}/{name_exp.lower().replace(" ", "-")}-backend'},
                {'label': 'API Demo', 'url': f'https://api.{handle}.example.com/docs'}
            ]
        },
        'frontend': {
            'tech': tech_frontend,
            'highlights': [
                'Created a polished frontend experience with responsive UI patterns.',
                'Integrated live data flows and developer-friendly build tooling.'
            ],
            'links': [
                {'label': 'Live Demo', 'url': f'https://{name_exp.lower().replace(" ", "-")}.example.com'},
                {'label': 'Frontend Repo', 'url': f'https://github.com/{handle}/{name_exp.lower().replace(" ", "-")}-frontend'}
            ]
        }
    })
new['experiments'] = experiments

new_skills = {}
for cat, items in skills.items():
    new_skills[cat] = random.sample(items, min(len(items), 6))
new['skills'] = new_skills
new['certifications'] = random.sample(certs, 3)

out_json = Path('randomized_resume.json')
with open(out_json, 'w', encoding='utf-8') as f:
    json.dump(new, f, indent=2, ensure_ascii=False)

pdf_dir = Path('assets/resume')
pdf_dir.mkdir(parents=True, exist_ok=True)
pdf_name = f"{name.replace(' ', '-')}-Resume.pdf"
pdf_path = pdf_dir / pdf_name

class ResumePDF(FPDF):
    def header(self):
        self.set_font('Helvetica', 'B', 16)
        self.cell(0, 10, new['basics']['name'], ln=True)
        self.set_font('Helvetica', '', 11)
        self.cell(0, 8, new['basics']['role'], ln=True)
        self.ln(2)

    def section_title(self, title: str):
        self.set_font('Helvetica', 'B', 12)
        self.set_text_color(40, 40, 40)
        self.cell(0, 8, title, ln=True)
        self.ln(1)

pdf = ResumePDF()
pdf.add_page()
pdf.set_auto_page_break(True, margin=15)
pdf.set_font('Helvetica', '', 10)

contact = f"{new['basics']['email']} | {new['basics']['phone']} | {new['basics']['location']}"
pdf.multi_cell(0, 5, contact)
pdf.set_font('Helvetica', 'B', 10)
pdf.multi_cell(0, 5, f"LinkedIn: {new['basics']['linkedin']}")
pdf.multi_cell(0, 5, f"GitHub: {new['basics']['github']}")
pdf.set_font('Helvetica', '', 10)
pdf.ln(3)

pdf.section_title('Summary')
pdf.multi_cell(0, 5, new['summary'])
pdf.ln(2)

pdf.section_title('Experience')
for exp in new['experience']:
    pdf.set_font('Helvetica', 'B', 11)
    pdf.cell(0, 5, f"{exp['title']} - {exp['company']} | {exp['start']} - {exp['end']}", ln=True)
    pdf.set_font('Helvetica', '', 10)
    pdf.multi_cell(0, 5, exp['location'])
    for h in exp['highlights']:
        pdf.multi_cell(0, 5, f'- {h}')
    pdf.ln(1)

pdf.section_title('Education')
for ed in new['education']:
    pdf.set_font('Helvetica', 'B', 11)
    pdf.cell(0, 5, f"{ed['degree']} - {ed['school']}", ln=True)
    pdf.set_font('Helvetica', '', 10)
    pdf.cell(0, 5, f"{ed['start']} - {ed['end']}", ln=True)
    pdf.ln(1)

pdf.section_title('Skills')
for cat, items in new['skills'].items():
    pdf.set_font('Helvetica', 'B', 10)
    pdf.cell(0, 5, cat, ln=True)
    pdf.set_font('Helvetica', '', 10)
    pdf.multi_cell(0, 5, ', '.join(items))
    pdf.ln(1)

pdf.section_title('Certifications')
pdf.multi_cell(0, 5, ', '.join(new['certifications']))
pdf.ln(2)

pdf.section_title('Recommendations')
for category, recs in new['recommendationCategories'].items():
    pdf.set_font('Helvetica', 'B', 11)
    pdf.cell(0, 5, category, ln=True)
    pdf.set_font('Helvetica', '', 10)
    for rec in recs:
        pdf.set_font('Helvetica', 'B', 10)
        pdf.cell(0, 5, f"{rec['name']} - {rec['role']}", ln=True)
        pdf.set_font('Helvetica', '', 10)
        pdf.multi_cell(0, 5, rec['quote'])
        pdf.multi_cell(0, 5, f"{rec['source']} - {rec['linkedinUrl']}")
        pdf.ln(1)
    pdf.ln(1)

pdf.section_title('Experiments')
for exp in new['experiments']:
    pdf.set_font('Helvetica', 'B', 11)
    pdf.cell(0, 5, f"{exp['name']} ({exp['type']})", ln=True)
    pdf.set_font('Helvetica', '', 10)
    pdf.multi_cell(0, 5, 'Backend: ' + ', '.join(exp['backend']['tech']))
    pdf.multi_cell(0, 5, 'Frontend: ' + ', '.join(exp['frontend']['tech']))
    for line in exp['backend']['highlights']:
        pdf.multi_cell(0, 5, f'- {line}')
    for line in exp['frontend']['highlights']:
        pdf.multi_cell(0, 5, f'- {line}')
    links = exp['backend']['links'] + exp['frontend']['links']
    pdf.multi_cell(0, 5, 'Links: ' + ', '.join([f"{link['label']} ({link['url']})" for link in links]))
    pdf.ln(1)

pdf.output(str(pdf_path))

print('generated json:', out_json)
print('generated pdf:', pdf_path)
print('name:', name)
