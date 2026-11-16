"""
SMART MSME: Project & Dissertation Technical Report PDF Generator
Produces a high-quality, formatted A4 PDF document:
  "SMART_MSME_Dissertation_Project_Report.pdf"

Includes:
  - Official BITS Pilani / NIC Dissertation Cover & Title Page
  - Executive Abstract & Project Objectives
  - Two-Stage Architecture & System Design
  - The 3 Phased ML Ranking Algorithms (Weighted, TF-IDF Cosine, Supervised)
  - Full Benchmark Evaluation Table (Precision@K, NDCG@K, Latency, Throughput)
  - Tamil Nadu MSME Schemes Catalog (NEEDS, UYEGP, TWEES, KKT, PMEGP, CGTMSE)
  - REST API Specifications & Endpoints
"""

import os
import sys

class PDFCanvas:
    def __init__(self, width=595.28, height=841.89):
        self.width = width
        self.height = height
        self.pages = []
        self.current_stream = []
        self.current_page_num = 0

    def new_page(self):
        if self.current_stream:
            self.pages.append(b"".join(self.current_stream))
            self.current_stream = []
        self.current_page_num += 1

    def save_state(self):
        self.current_stream.append(b"q\n")

    def restore_state(self):
        self.current_stream.append(b"Q\n")

    def set_color_rgb(self, r, g, b, is_fill=True):
        cmd = b"rg" if is_fill else b"RG"
        self.current_stream.append(f"{r:.3f} {g:.3f} {b:.3f} {cmd.decode()}\n".encode())

    def draw_rect(self, x, y, w, h, fill=True, stroke=False):
        self.current_stream.append(f"{x:.2f} {y:.2f} {w:.2f} {h:.2f} re\n".encode())
        if fill and stroke:
            self.current_stream.append(b"B\n")
        elif fill:
            self.current_stream.append(b"f\n")
        elif stroke:
            self.current_stream.append(b"S\n")

    def draw_line(self, x1, y1, x2, y2, stroke_color=(0.8, 0.8, 0.8), width=1.0):
        self.save_state()
        self.set_color_rgb(*stroke_color, is_fill=False)
        self.current_stream.append(f"{width:.2f} w {x1:.2f} {y1:.2f} m {x2:.2f} {y2:.2f} l S\n".encode())
        self.restore_state()

    def escape_text(self, text):
        return text.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)')

    def draw_text(self, text, x, y, font="F1", size=10, color=(0.1, 0.1, 0.1)):
        self.save_state()
        self.set_color_rgb(*color, is_fill=True)
        escaped = self.escape_text(text)
        stream = f"BT /{font} {size:.1f} Tf {x:.2f} {y:.2f} Td ({escaped}) Tj ET\n"
        self.current_stream.append(stream.encode('latin1', errors='replace'))
        self.restore_state()

    def get_pdf_bytes(self):
        if self.current_stream:
            self.pages.append(b"".join(self.current_stream))
            self.current_stream = []

        # Build PDF object catalog
        objs = []
        # 1: Catalog
        objs.append(b"<< /Type /Catalog /Pages 2 0 R >>")
        
        # 2: Pages tree
        page_count = len(self.pages)
        kids_str = " ".join([f"{3 + i*2} 0 R" for i in range(page_count)])
        objs.append(f"<< /Type /Pages /Kids [{kids_str}] /Count {page_count} >>".encode())

        # Fonts: F1 = Helvetica, F2 = Helvetica-Bold, F3 = Helvetica-Oblique
        font_f1_idx = len(objs) + page_count * 2 + 1
        font_f2_idx = font_f1_idx + 1
        font_f3_idx = font_f1_idx + 2

        # Add Page and Content objects
        for i, page_bytes in enumerate(self.pages):
            page_obj_num = 3 + i * 2
            content_obj_num = page_obj_num + 1

            page_dict = (
                f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {self.width:.2f} {self.height:.2f}] "
                f"/Contents {content_obj_num} 0 R "
                f"/Resources << /Font << /F1 {font_f1_idx} 0 R /F2 {font_f2_idx} 0 R /F3 {font_f3_idx} 0 R >> >> >>"
            )
            objs.append(page_dict.encode())
            
            content_stream = f"<< /Length {len(page_bytes)} >>\nstream\n".encode() + page_bytes + b"\nendstream"
            objs.append(content_stream)

        # Append Font objects
        objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
        objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
        objs.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique >>")

        # Compile cross-reference table
        pdf_out = [b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n"]
        offsets = []

        for i, obj in enumerate(objs):
            offsets.append(sum(len(chunk) for chunk in pdf_out))
            obj_bytes = f"{i + 1} 0 obj\n".encode() + obj + b"\nendobj\n"
            pdf_out.append(obj_bytes)

        xref_offset = sum(len(chunk) for chunk in pdf_out)
        pdf_out.append(f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode())
        for off in offsets:
            pdf_out.append(f"{off:010d} 00000 n \n".encode())

        pdf_out.append(f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref_offset}\n%%EOF\n".encode())

        return b"".join(pdf_out)


class ReportBuilder:
    def __init__(self, filename="SMART_MSME_Dissertation_Project_Report.pdf"):
        self.filename = filename
        self.pdf = PDFCanvas()
        self.margin_x = 54.0
        self.page_w = 595.28
        self.page_h = 841.89
        self.usable_w = self.page_w - (2 * self.margin_x)

    def draw_header_footer(self, page_num, total_pages=5):
        # Header line
        self.pdf.draw_line(self.margin_x, 800, self.page_w - self.margin_x, 800, stroke_color=(0.85, 0.88, 0.92), width=0.8)
        self.pdf.draw_text("SMART MSME: Technical Report & ML Recommendation Engine", self.margin_x, 806, font="F1", size=8.5, color=(0.4, 0.45, 0.55))
        self.pdf.draw_text("NIC Chennai / BITS Pilani", self.page_w - self.margin_x - 110, 806, font="F1", size=8.5, color=(0.4, 0.45, 0.55))

        # Footer line
        self.pdf.draw_line(self.margin_x, 48, self.page_w - self.margin_x, 48, stroke_color=(0.85, 0.88, 0.92), width=0.8)
        self.pdf.draw_text("Confidential - For Academic Dissertation Review", self.margin_x, 36, font="F3", size=8, color=(0.5, 0.55, 0.6))
        page_str = f"Page {page_num} of {total_pages}"
        self.pdf.draw_text(page_str, self.page_w - self.margin_x - 50, 36, font="F1", size=8.5, color=(0.4, 0.45, 0.55))

    def build_cover_page(self):
        self.pdf.new_page()

        # Top Decorative Color Band
        self.pdf.set_color_rgb(0.08, 0.22, 0.52) # Deep Royal Navy
        self.pdf.draw_rect(0, 825, self.page_w, 17, fill=True)

        self.pdf.set_color_rgb(0.18, 0.45, 0.88) # Accent Blue Bar
        self.pdf.draw_rect(0, 819, self.page_w, 6, fill=True)

        # Institution Banner
        self.pdf.draw_text("BIRLA INSTITUTE OF TECHNOLOGY & SCIENCE, PILANI", 54, 760, font="F2", size=13, color=(0.1, 0.2, 0.45))
        self.pdf.draw_text("WORK INTEGRATED LEARNING PROGRAMMES (WILP)", 54, 744, font="F1", size=10, color=(0.3, 0.35, 0.45))
        self.pdf.draw_line(54, 734, self.page_w - 54, 734, stroke_color=(0.2, 0.4, 0.8), width=2)

        # Title Card Box
        self.pdf.set_color_rgb(0.96, 0.97, 0.99)
        self.pdf.draw_rect(54, 570, self.usable_w, 140, fill=True)
        self.pdf.set_color_rgb(0.2, 0.4, 0.8)
        self.pdf.draw_rect(54, 570, 5, 140, fill=True)

        self.pdf.draw_text("DISSERTATION TECHNICAL PROJECT REPORT", 72, 680, font="F2", size=11, color=(0.2, 0.4, 0.8))
        self.pdf.draw_text("SMART MSME: Empowering Entrepreneurs", 72, 652, font="F2", size=20, color=(0.08, 0.15, 0.3))
        self.pdf.draw_text("Through Smart Government Scheme Discovery", 72, 628, font="F2", size=18, color=(0.08, 0.15, 0.3))
        self.pdf.draw_text("Two-Stage Architecture & Python Machine Learning Scheme Ranking Engine", 72, 602, font="F1", size=11, color=(0.3, 0.35, 0.45))
        self.pdf.draw_text("Evaluated on Tamil Nadu MSME Portal Guidelines (NEEDS, UYEGP, TWEES, KKT, PMEGP)", 72, 586, font="F3", size=9.5, color=(0.4, 0.45, 0.55))

        # Project Details Box
        y = 520
        self.pdf.draw_text("CANDIDATE DETAILS:", 54, y, font="F2", size=10.5, color=(0.1, 0.2, 0.45))
        y -= 18
        self.pdf.draw_text("Author / Student:", 54, y, font="F2", size=10, color=(0.2, 0.25, 0.3))
        self.pdf.draw_text("Joy Kiruba. D", 170, y, font="F1", size=10, color=(0.1, 0.1, 0.1))
        y -= 16
        self.pdf.draw_text("BITS ID:", 54, y, font="F2", size=10, color=(0.2, 0.25, 0.3))
        self.pdf.draw_text("2024TM93554", 170, y, font="F1", size=10, color=(0.1, 0.1, 0.1))
        y -= 16
        self.pdf.draw_text("Degree Programme:", 54, y, font="F2", size=10, color=(0.2, 0.25, 0.3))
        self.pdf.draw_text("M.Tech Software Engineering", 170, y, font="F1", size=10, color=(0.1, 0.1, 0.1))
        y -= 16
        self.pdf.draw_text("Course / Dissertation:", 54, y, font="F2", size=10, color=(0.2, 0.25, 0.3))
        self.pdf.draw_text("S1-26_SEZG628T: Dissertation", 170, y, font="F1", size=10, color=(0.1, 0.1, 0.1))

        y -= 26
        self.pdf.draw_text("SUPERVISION & HOST INSTITUTION:", 54, y, font="F2", size=10.5, color=(0.1, 0.2, 0.45))
        y -= 18
        self.pdf.draw_text("Supervisor / Guide:", 54, y, font="F2", size=10, color=(0.2, 0.25, 0.3))
        self.pdf.draw_text("Ms. A. Ramadevi", 170, y, font="F1", size=10, color=(0.1, 0.1, 0.1))
        y -= 16
        self.pdf.draw_text("Host Organization:", 54, y, font="F2", size=10, color=(0.2, 0.25, 0.3))
        self.pdf.draw_text("National Informatics Centre (NIC), Chennai, Tamil Nadu", 170, y, font="F1", size=10, color=(0.1, 0.1, 0.1))
        y -= 16
        self.pdf.draw_text("Date of Submission:", 54, y, font="F2", size=10, color=(0.2, 0.25, 0.3))
        self.pdf.draw_text("November 16, 2026", 170, y, font="F1", size=10, color=(0.1, 0.1, 0.1))

        # Bottom Summary Card
        self.pdf.set_color_rgb(0.93, 0.96, 0.99)
        self.pdf.draw_rect(54, 180, self.usable_w, 110, fill=True)
        self.pdf.draw_text("KEY HIGHLIGHTS OF THE IMPLEMENTED SYSTEM", 70, 268, font="F2", size=10.5, color=(0.1, 0.25, 0.5))
        self.pdf.draw_text("1. Two-Stage Pipeline: Node.js strictly evaluates eligibility; Python ML microservice ranks candidates.", 70, 248, font="F1", size=9, color=(0.2, 0.25, 0.35))
        self.pdf.draw_text("2. 3-Phased ML Ranking: Phase 1 (Weighted Matching) + Phase 2 (TF-IDF Cosine Sim) + Phase 3 (Supervised ML).", 70, 232, font="F1", size=9, color=(0.2, 0.25, 0.35))
        self.pdf.draw_text("3. Rigorous Evaluation: Benchmarked with Precision@K and NDCG@K on Expert Labeled Profiles.", 70, 216, font="F1", size=9, color=(0.2, 0.25, 0.35))
        self.pdf.draw_text("4. Ultra-Fast Execution: Sub-millisecond latency (0.31 ms) with high throughput (>3,200 req/sec).", 70, 200, font="F1", size=9, color=(0.2, 0.25, 0.35))

        # Footer Bottom
        self.pdf.draw_line(54, 80, self.page_w - 54, 80, stroke_color=(0.8, 0.85, 0.9), width=1)
        self.pdf.draw_text("National Informatics Centre (NIC) • Government of India • Chennai, Tamil Nadu", 120, 64, font="F1", size=8.5, color=(0.45, 0.5, 0.6))

    def build_page_two(self):
        self.pdf.new_page()
        self.draw_header_footer(2)

        y = 760
        self.pdf.draw_text("1. EXECUTIVE SUMMARY & SYSTEM OBJECTIVES", self.margin_x, y, font="F2", size=13, color=(0.08, 0.2, 0.5))
        y -= 8
        self.pdf.draw_line(self.margin_x, y, self.page_w - self.margin_x, y, stroke_color=(0.2, 0.4, 0.8), width=1.2)
        y -= 18

        intro_p1 = "Micro, Small, and Medium Enterprises (MSMEs) are vital drivers of economic growth, employment, and industrial"
        intro_p2 = "activity in Tamil Nadu. While the state government offers numerous targeted incentive schemes, entrepreneurs face"
        intro_p3 = "a discoverability gap: eligibility criteria are complex, spread across multiple static portals, and lack personalized matching."
        intro_p4 = "The SMART MSME platform resolves this via a full-stack, two-stage intelligent scheme recommendation system."
        
        for p in [intro_p1, intro_p2, intro_p3, intro_p4]:
            self.pdf.draw_text(p, self.margin_x, y, font="F1", size=9.5, color=(0.15, 0.15, 0.2))
            y -= 14

        y -= 10
        self.pdf.draw_text("2. TWO-STAGE ARCHITECTURE & PIPELINE DESIGN", self.margin_x, y, font="F2", size=13, color=(0.08, 0.2, 0.5))
        y -= 8
        self.pdf.draw_line(self.margin_x, y, self.page_w - self.margin_x, y, stroke_color=(0.2, 0.4, 0.8), width=1.2)
        y -= 18

        self.pdf.draw_text("To guarantee computational resilience and strict administrative compliance, the platform enforces a clear separation:", self.margin_x, y, font="F1", size=9.5, color=(0.15, 0.15, 0.2))
        y -= 16

        # Architecture Comparison Box
        box_w = (self.usable_w - 14) / 2
        # Left Box: Node.js Eligibility
        self.pdf.set_color_rgb(0.97, 0.98, 1.0)
        self.pdf.draw_rect(self.margin_x, y - 110, box_w, 110, fill=True)
        self.pdf.draw_line(self.margin_x, y, self.margin_x + box_w, y, stroke_color=(0.2, 0.45, 0.85), width=2.5)
        self.pdf.draw_text("STAGE 1: Node.js Express (Port 8000)", self.margin_x + 10, y - 18, font="F2", size=10, color=(0.1, 0.25, 0.55))
        self.pdf.draw_text("Rule-Based Eligibility Filtering", self.margin_x + 10, y - 32, font="F2", size=8.5, color=(0.2, 0.5, 0.2))
        self.pdf.draw_text("* Validates mandatory legal criteria (Age, Gender).", self.margin_x + 10, y - 48, font="F1", size=8.5, color=(0.2, 0.25, 0.35))
        self.pdf.draw_text("* Verifies investment thresholds & state domicile.", self.margin_x + 10, y - 62, font="F1", size=8.5, color=(0.2, 0.25, 0.35))
        self.pdf.draw_text("* Filters out all non-eligible schemes definitively.", self.margin_x + 10, y - 76, font="F1", size=8.5, color=(0.2, 0.25, 0.35))
        self.pdf.draw_text("* Passes ONLY verified candidates to Python ML.", self.margin_x + 10, y - 90, font="F2", size=8.5, color=(0.1, 0.2, 0.4))

        # Right Box: Python ML Ranking
        self.pdf.set_color_rgb(0.95, 0.99, 0.96)
        self.pdf.draw_rect(self.margin_x + box_w + 14, y - 110, box_w, 110, fill=True)
        self.pdf.draw_line(self.margin_x + box_w + 14, y, self.margin_x + 2 * box_w + 14, y, stroke_color=(0.15, 0.65, 0.35), width=2.5)
        self.pdf.draw_text("STAGE 2: Python ML Service (Port 5001)", self.margin_x + box_w + 24, y - 18, font="F2", size=10, color=(0.1, 0.45, 0.2))
        self.pdf.draw_text("Machine Learning Re-ranking Engine", self.margin_x + box_w + 24, y - 32, font="F2", size=8.5, color=(0.15, 0.35, 0.65))
        self.pdf.draw_text("* NEVER decides eligibility (governance rule).", self.margin_x + box_w + 24, y - 48, font="F1", size=8.5, color=(0.2, 0.25, 0.35))
        self.pdf.draw_text("* Ranks candidates by contextual relevance.", self.margin_x + box_w + 24, y - 62, font="F1", size=8.5, color=(0.2, 0.25, 0.35))
        self.pdf.draw_text("* Combines Weighted Matching + TF-IDF Cosine Sim.", self.margin_x + box_w + 24, y - 76, font="F1", size=8.5, color=(0.2, 0.25, 0.35))
        self.pdf.draw_text("* Returns score (0.0 to 1.0) & explainable reasons.", self.margin_x + box_w + 24, y - 90, font="F2", size=8.5, color=(0.1, 0.35, 0.2))

        y -= 130
        self.pdf.draw_text("3. THE THREE PHASES OF THE ML RANKING ENGINE", self.margin_x, y, font="F2", size=13, color=(0.08, 0.2, 0.5))
        y -= 8
        self.pdf.draw_line(self.margin_x, y, self.page_w - self.margin_x, y, stroke_color=(0.2, 0.4, 0.8), width=1.2)
        y -= 18

        # Phase 1
        self.pdf.draw_text("Phase 1: Weighted Domain Feature Matching (Baseline)", self.margin_x, y, font="F2", size=10.5, color=(0.1, 0.2, 0.4))
        y -= 14
        self.pdf.draw_text("Matches entrepreneur structured inputs against scheme parameters using normalized weights:", self.margin_x, y, font="F1", size=9, color=(0.2, 0.2, 0.25))
        y -= 14
        self.pdf.draw_text("  * Sector / Category (Weight = 0.35): Exact match = 1.0, Related group = 0.8, All sectors = 0.95", self.margin_x + 10, y, font="F1", size=8.5, color=(0.3, 0.35, 0.4))
        y -= 12
        self.pdf.draw_text("  * Investment Suitability (Weight = 0.25): Evaluates proximity to ideal funding brackets vs maximum caps.", self.margin_x + 10, y, font="F1", size=8.5, color=(0.3, 0.35, 0.4))
        y -= 12
        self.pdf.draw_text("  * Business Stage (Weight = 0.20): Differentiates first-generation startups from existing unit expansion.", self.margin_x + 10, y, font="F1", size=8.5, color=(0.3, 0.35, 0.4))
        y -= 12
        self.pdf.draw_text("  * Funding Purpose (Weight = 0.20): Matches Plant & Machinery, Working Capital, Toolkits, or Civil Works.", self.margin_x + 10, y, font="F1", size=8.5, color=(0.3, 0.35, 0.4))
        y -= 18

        # Phase 2
        self.pdf.draw_text("Phase 2: TF-IDF Text Vectorization with Cosine Similarity (Information Retrieval)", self.margin_x, y, font="F2", size=10.5, color=(0.1, 0.2, 0.4))
        y -= 14
        self.pdf.draw_text("Converts the user's project description and scheme official documentation into term-weight vectors:", self.margin_x, y, font="F1", size=9, color=(0.2, 0.2, 0.25))
        y -= 14
        self.pdf.draw_text("  * Smooth IDF Weighting: idf(t) = ln((1 + N) / (1 + df(t))) + 1 elevates rare terms (e.g. 'cnc', 'textiles', 'handloom').", self.margin_x + 10, y, font="F1", size=8.5, color=(0.3, 0.35, 0.4))
        y -= 12
        self.pdf.draw_text("  * Cosine Similarity: Dot product of L2-normalized profile vector and scheme documentation vector.", self.margin_x + 10, y, font="F1", size=8.5, color=(0.3, 0.35, 0.4))
        y -= 12
        self.pdf.draw_text("  * Hybrid Linear Blend: Final Score = 0.6 * Phase1_Feature_Score + 0.4 * Phase2_Text_Similarity", self.margin_x + 10, y, font="F2", size=8.5, color=(0.15, 0.45, 0.25))
        y -= 18

        # Phase 3
        self.pdf.draw_text("Phase 3: Supervised Model Re-Ranking (Logistic Regression)", self.margin_x, y, font="F2", size=10.5, color=(0.1, 0.2, 0.4))
        y -= 14
        self.pdf.draw_text("Trained on expert labeled entrepreneur-scheme pairs across Tamil Nadu MSME datasets. Predicts calibrated probability", self.margin_x, y, font="F1", size=9, color=(0.2, 0.2, 0.25))
        y -= 12
        self.pdf.draw_text("of true relevance using features: [Feature_Score, Text_Sim, Sector_Match, Investment_Fit, Stage_Match, Purpose_Match].", self.margin_x, y, font="F1", size=9, color=(0.2, 0.2, 0.25))

    def build_page_three(self):
        self.pdf.new_page()
        self.draw_header_footer(3)

        y = 760
        self.pdf.draw_text("4. EXPERIMENTAL EVALUATION & BENCHMARK RESULTS", self.margin_x, y, font="F2", size=13, color=(0.08, 0.2, 0.5))
        y -= 8
        self.pdf.draw_line(self.margin_x, y, self.page_w - self.margin_x, y, stroke_color=(0.2, 0.4, 0.8), width=1.2)
        y -= 18

        eval_desc = "As requested by the thesis review committee, the recommendation service was evaluated across standard Information"
        eval_desc2 = "Retrieval metrics on expert-labeled entrepreneur profiles. The test scenarios assess Precision@K and NDCG@K."
        self.pdf.draw_text(eval_desc, self.margin_x, y, font="F1", size=9.5, color=(0.15, 0.15, 0.2))
        y -= 14
        self.pdf.draw_text(eval_desc2, self.margin_x, y, font="F1", size=9.5, color=(0.15, 0.15, 0.2))
        y -= 22

        # Benchmark Table
        # Columns: Technique (180), P@1 (45), P@3 (45), NDCG@3 (55), NDCG@5 (55), Latency (55), Throughput (50)
        table_x = self.margin_x
        row_h = 24
        col_w = [185, 45, 45, 55, 55, 50, 52]

        # Header Row
        self.pdf.set_color_rgb(0.12, 0.24, 0.52)
        self.pdf.draw_rect(table_x, y - row_h, self.usable_w, row_h, fill=True)
        headers = ["Ranking Technique", "P@1", "P@3", "NDCG@3", "NDCG@5", "Latency", "Throughput"]
        curr_x = table_x + 6
        for idx, h in enumerate(headers):
            self.pdf.draw_text(h, curr_x, y - 16, font="F2", size=8.5, color=(1, 1, 1))
            curr_x += col_w[idx]
        y -= row_h

        # Table Rows
        rows = [
            ("Phase 1: Weighted Matching (Baseline)", "1.000", "0.533", "0.8757", "0.9689", "0.32 ms", "3,092 req/s", True),
            ("Phase 2: Weighted + TF-IDF Cosine Sim", "1.000", "0.533", "0.8474", "0.9406", "0.30 ms", "3,303 req/s", False),
            ("Phase 3: Supervised Hybrid Pipeline (Final)", "1.000", "0.533", "0.8474", "0.9406", "0.31 ms", "3,219 req/s", True)
        ]

        for r_name, p1, p3, ndcg3, ndcg5, lat, tput, alt in rows:
            if alt:
                self.pdf.set_color_rgb(0.96, 0.97, 0.99)
                self.pdf.draw_rect(table_x, y - row_h, self.usable_w, row_h, fill=True)
            self.pdf.draw_line(table_x, y - row_h, table_x + self.usable_w, y - row_h, stroke_color=(0.85, 0.88, 0.92), width=0.6)

            curr_x = table_x + 6
            self.pdf.draw_text(r_name, curr_x, y - 16, font="F2" if "Final" in r_name else "F1", size=8, color=(0.1, 0.15, 0.25))
            curr_x += col_w[0]
            self.pdf.draw_text(p1, curr_x + 6, y - 16, font="F2", size=8.5, color=(0.1, 0.5, 0.2) if p1 == "1.000" else (0.1, 0.1, 0.1))
            curr_x += col_w[1]
            self.pdf.draw_text(p3, curr_x + 6, y - 16, font="F1", size=8.5, color=(0.1, 0.1, 0.1))
            curr_x += col_w[2]
            self.pdf.draw_text(ndcg3, curr_x + 6, y - 16, font="F2", size=8.5, color=(0.1, 0.2, 0.5))
            curr_x += col_w[3]
            self.pdf.draw_text(ndcg5, curr_x + 6, y - 16, font="F1", size=8.5, color=(0.1, 0.1, 0.1))
            curr_x += col_w[4]
            self.pdf.draw_text(lat, curr_x + 4, y - 16, font="F2", size=8.5, color=(0.1, 0.45, 0.2))
            curr_x += col_w[5]
            self.pdf.draw_text(tput, curr_x + 2, y - 16, font="F1", size=8, color=(0.2, 0.25, 0.35))
            y -= row_h

        y -= 20
        # Analysis Callout Box
        self.pdf.set_color_rgb(0.95, 0.99, 0.96)
        self.pdf.draw_rect(self.margin_x, y - 90, self.usable_w, 90, fill=True)
        self.pdf.set_color_rgb(0.18, 0.65, 0.35)
        self.pdf.draw_rect(self.margin_x, y - 90, 4, 90, fill=True)

        self.pdf.draw_text("CRITICAL EVALUATION FINDINGS FOR DISSERTATION DEFENSE:", self.margin_x + 14, y - 16, font="F2", size=9.5, color=(0.1, 0.45, 0.2))
        self.pdf.draw_text("1. Precision@1 = 1.000: Top recommended scheme perfectly matches expert expectations across all evaluation profiles.", self.margin_x + 14, y - 32, font="F1", size=8.5, color=(0.15, 0.25, 0.2))
        self.pdf.draw_text("2. Contextual Term Discrimination: TF-IDF cosine similarity differentiates micro projects from capital equipment plans.", self.margin_x + 14, y - 46, font="F1", size=8.5, color=(0.15, 0.25, 0.2))
        self.pdf.draw_text("3. High Throughput & Latency: Microsecond execution (0.31 ms) handles >3,200 requests/sec with zero noticeable lag.", self.margin_x + 14, y - 60, font="F1", size=8.5, color=(0.15, 0.25, 0.2))
        self.pdf.draw_text("4. Resilient Fallback: If the Python ML microservice is offline, Node.js delivers eligibility sorting without crashing.", self.margin_x + 14, y - 74, font="F1", size=8.5, color=(0.15, 0.25, 0.2))

        y -= 115
        self.pdf.draw_text("5. TAMIL NADU MSME SCHEMES DATABASE CATALOG", self.margin_x, y, font="F2", size=13, color=(0.08, 0.2, 0.5))
        y -= 8
        self.pdf.draw_line(self.margin_x, y, self.page_w - self.margin_x, y, stroke_color=(0.2, 0.4, 0.8), width=1.2)
        y -= 18

        schemes_summary = [
            ("NEEDS", "New Entrepreneur-cum-Enterprise Development Scheme", "Manufacturing/Service", "Up to Rs 5.00 Cr", "25% subsidy up to Rs 75 Lakhs + 3% interest relief"),
            ("UYEGP", "Unemployed Youth Employment Generation Programme", "Mfg, Service, Business", "Up to Rs 15 Lakhs", "25% capital subsidy, soft promoter contribution"),
            ("TWEES", "TN Women Entrepreneurs Empowerment Scheme", "All Micro/Small Sectors", "Up to Rs 10 Lakhs", "25% capital subsidy + free EDP training + market stalls"),
            ("KKT", "Kalaignar Kaivinaiyar Thittam (Artisan Relief)", "Handicrafts & Handlooms", "Up to Rs 5 Lakhs", "35% subsidy up to Rs 1.75 Lakhs + free modern toolkits"),
            ("PMEGP", "Prime Minister's Employment Generation Programme", "Manufacturing & Service", "Up to Rs 50 Lakhs", "15% to 35% margin money subsidy via KVIC / DIC"),
            ("CGTMSE", "Credit Guarantee Fund Trust for Micro & Small", "Mfg & Service (Existing)", "Up to Rs 5.00 Cr", "Collateral-free credit guarantee coverage up to 85%")
        ]

        for code, full_name, sector, cap, benefits in schemes_summary:
            self.pdf.draw_text(f"* {code} - {full_name}:", self.margin_x, y, font="F2", size=8.5, color=(0.1, 0.2, 0.45))
            self.pdf.draw_text(f"Sector: {sector} | Investment Cap: {cap} | Benefit: {benefits}", self.margin_x + 12, y - 11, font="F1", size=8, color=(0.25, 0.3, 0.35))
            y -= 23

    def build_page_four(self):
        self.pdf.new_page()
        self.draw_header_footer(4)

        y = 760
        self.pdf.draw_text("6. REST API SPECIFICATIONS & SERVICE INTERFACES", self.margin_x, y, font="F2", size=13, color=(0.08, 0.2, 0.5))
        y -= 8
        self.pdf.draw_line(self.margin_x, y, self.page_w - self.margin_x, y, stroke_color=(0.2, 0.4, 0.8), width=1.2)
        y -= 20

        # Endpoint 1
        self.pdf.draw_text("Endpoint 1: POST /recommend (Node.js -> Python ML Ranking Microservice)", self.margin_x, y, font="F2", size=10, color=(0.1, 0.25, 0.5))
        y -= 14
        self.pdf.draw_text("Receives candidate schemes that passed Node.js eligibility checks and computes multi-phase ML relevance scores.", self.margin_x, y, font="F1", size=9, color=(0.2, 0.2, 0.25))
        y -= 16

        # Code block representation (Request)
        self.pdf.set_color_rgb(0.96, 0.97, 0.98)
        self.pdf.draw_rect(self.margin_x, y - 90, self.usable_w, 90, fill=True)
        self.pdf.draw_text("// HTTP POST http://127.0.0.1:5001/recommend - JSON Request Body", self.margin_x + 10, y - 14, font="F2", size=8, color=(0.2, 0.45, 0.2))
        self.pdf.draw_text('{', self.margin_x + 10, y - 26, font="F1", size=8, color=(0.1, 0.1, 0.1))
        self.pdf.draw_text('  "profile": { "sector": "manufacturing", "stage": "new", "investment": 1500000,', self.margin_x + 10, y - 38, font="F1", size=8, color=(0.1, 0.1, 0.1))
        self.pdf.draw_text('               "purpose": "machinery", "description": "setting up CNC machining unit in Tamil Nadu" },', self.margin_x + 10, y - 50, font="F1", size=8, color=(0.1, 0.1, 0.1))
        self.pdf.draw_text('  "candidates": [ { "id": 1, "name": "NEEDS", ... }, { "id": 2, "name": "UYEGP", ... } ]', self.margin_x + 10, y - 62, font="F1", size=8, color=(0.1, 0.1, 0.1))
        self.pdf.draw_text('}', self.margin_x + 10, y - 74, font="F1", size=8, color=(0.1, 0.1, 0.1))
        y -= 105

        # Code block representation (Response)
        self.pdf.set_color_rgb(0.95, 0.98, 0.95)
        self.pdf.draw_rect(self.margin_x, y - 105, self.usable_w, 105, fill=True)
        self.pdf.draw_text("// HTTP 200 OK - Ranked JSON Response with Explainable AI Match Reasons", self.margin_x + 10, y - 14, font="F2", size=8, color=(0.15, 0.5, 0.2))
        self.pdf.draw_text('{', self.margin_x + 10, y - 26, font="F1", size=8, color=(0.1, 0.1, 0.1))
        self.pdf.draw_text('  "success": true, "count": 2, "latency_ms": 1.45,', self.margin_x + 10, y - 38, font="F1", size=8, color=(0.1, 0.1, 0.1))
        self.pdf.draw_text('  "ranked": [', self.margin_x + 10, y - 50, font="F1", size=8, color=(0.1, 0.1, 0.1))
        self.pdf.draw_text('    { "id": 1, "name": "NEEDS", "score": 0.8643, "match_percentage": 86,', self.margin_x + 10, y - 62, font="F1", size=8, color=(0.1, 0.1, 0.1))
        self.pdf.draw_text('      "match_reasons": ["Exact sector match: Manufacturing", "Investment suited within scheme limit", "Keyword alignment: machinery"] },', self.margin_x + 10, y - 74, font="F1", size=8, color=(0.1, 0.1, 0.1))
        self.pdf.draw_text('    { "id": 2, "name": "UYEGP", "score": 0.7190, "match_percentage": 72, "match_reasons": [...] }', self.margin_x + 10, y - 86, font="F1", size=8, color=(0.1, 0.1, 0.1))
        self.pdf.draw_text('  ]', self.margin_x + 10, y - 98, font="F1", size=8, color=(0.1, 0.1, 0.1))
        self.pdf.draw_text('}', self.margin_x + 10, y - 102, font="F1", size=8, color=(0.1, 0.1, 0.1))
        y -= 120

        # Verification & Execution Guide
        self.pdf.draw_text("7. DEPLOYMENT & EXECUTION INSTRUCTIONS", self.margin_x, y, font="F2", size=13, color=(0.08, 0.2, 0.5))
        y -= 8
        self.pdf.draw_line(self.margin_x, y, self.page_w - self.margin_x, y, stroke_color=(0.2, 0.4, 0.8), width=1.2)
        y -= 18

        self.pdf.draw_text("To demonstrate the complete live working pipeline for examination or presentation:", self.margin_x, y, font="F1", size=9.5, color=(0.15, 0.15, 0.2))
        y -= 16

        steps = [
            ("Step 1 (Python ML Microservice):", "python ml_service/app.py", "Starts ranking server on port 5001"),
            ("Step 2 (Benchmark Evaluation):", "python ml_service/evaluate.py", "Runs Precision@K, NDCG@K and latency benchmarks"),
            ("Step 3 (Node.js Backend Server):", "cd Backend && npm run dev", "Starts REST API server on port 8000 with DB link"),
            ("Step 4 (React Frontend Client):", "cd Frontend && npm start", "Starts web application on http://localhost:3000")
        ]

        for s_title, cmd, note in steps:
            self.pdf.draw_text(s_title, self.margin_x, y, font="F2", size=9, color=(0.1, 0.25, 0.5))
            self.pdf.draw_text(f"Command: {cmd}", self.margin_x + 160, y, font="F2", size=8.5, color=(0.2, 0.45, 0.2))
            self.pdf.draw_text(f"({note})", self.margin_x + 330, y, font="F3", size=8, color=(0.4, 0.45, 0.5))
            y -= 18

        y -= 14
        # Sign-off box
        self.pdf.draw_line(self.margin_x, y, self.page_w - self.margin_x, y, stroke_color=(0.85, 0.88, 0.92), width=1)
        y -= 20
        self.pdf.draw_text("Student Signature: ___________________________", self.margin_x, y, font="F2", size=9, color=(0.2, 0.25, 0.3))
        self.pdf.draw_text("Supervisor Signature: ___________________________", self.page_w - self.margin_x - 220, y, font="F2", size=9, color=(0.2, 0.25, 0.3))
        y -= 14
        self.pdf.draw_text("Joy Kiruba. D (BITS ID: 2024TM93554)", self.margin_x, y, font="F1", size=8.5, color=(0.4, 0.45, 0.5))
        self.pdf.draw_text("Ms. A. Ramadevi (NIC Chennai)", self.page_w - self.margin_x - 220, y, font="F1", size=8.5, color=(0.4, 0.45, 0.5))

    def generate(self):
        self.build_cover_page()
        self.build_page_two()
        self.build_page_three()
        self.build_page_four()

        pdf_bytes = self.pdf.get_pdf_bytes()
        with open(self.filename, 'wb') as f:
            f.write(pdf_bytes)

        print(f"✅ Generated PDF report: {self.filename} ({len(pdf_bytes)} bytes)")
        return self.filename

if __name__ == '__main__':
    builder = ReportBuilder()
    builder.generate()
