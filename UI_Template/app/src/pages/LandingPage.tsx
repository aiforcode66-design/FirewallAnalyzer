import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Shield,
    Zap,
    BarChart3,
    GitCompare,
    FileText,
    Clock,
    Upload,
    Search,
    Download,
    CheckCircle2,
    TrendingUp,
    ChevronDown,
    Play
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
    const navigate = useNavigate();
    const [isVisible, setIsVisible] = useState<{ [key: string]: boolean }>({});
    const observerRef = useRef<IntersectionObserver | null>(null);

    useEffect(() => {
        observerRef.current = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsVisible((prev) => ({ ...prev, [entry.target.id]: true }));
                    }
                });
            },
            { threshold: 0.1 }
        );

        const sections = document.querySelectorAll('[data-animate]');
        sections.forEach((section) => observerRef.current?.observe(section));

        return () => observerRef.current?.disconnect();
    }, []);

    const scrollToSection = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="min-h-screen bg-gradient-subtle">
            {/* Navigation */}
            <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/40">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield className="w-8 h-8 text-primary" />
                        <span className="text-xl font-bold text-gradient">Firewall Analyzer</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" onClick={() => scrollToSection('features')}>
                            Features
                        </Button>
                        <Button variant="ghost" onClick={() => scrollToSection('how-it-works')}>
                            How It Works
                        </Button>
                        <Button onClick={() => navigate('/login')}>
                            Get Started
                        </Button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
                <div className="absolute inset-0 gradient-primary opacity-10"></div>
                <div className="absolute inset-0">
                    <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float"></div>
                    <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
                </div>

                <div className="relative max-w-7xl mx-auto px-6 text-center">
                    <div className="animate-slide-up">
                        <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight">
                            Simplify Firewall<br />
                            <span className="text-gradient">Management & Analysis</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto">
                            Automate firewall configuration analysis, streamline multi-vendor support, and gain actionable insights in minutes—not hours.
                        </p>
                        <div className="flex items-center justify-center gap-4">
                            <Button size="lg" className="text-lg px-8" onClick={() => navigate('/login')}>
                                Get Started Free
                            </Button>
                            <Button size="lg" variant="outline" className="text-lg px-8">
                                <Play className="w-5 h-5 mr-2" />
                                Watch Demo
                            </Button>
                        </div>
                    </div>

                    <div className="mt-16 animate-fade-in" style={{ animationDelay: '0.3s' }}>
                        <div className="glass-dark rounded-2xl p-8 shadow-glow max-w-4xl mx-auto">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-white">
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-gradient mb-2">10K+</div>
                                    <div className="text-sm opacity-80">Rules Analyzed</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-gradient mb-2">6</div>
                                    <div className="text-sm opacity-80">Vendors Supported</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-gradient mb-2">80%</div>
                                    <div className="text-sm opacity-80">Time Saved</div>
                                </div>
                                <div className="text-center">
                                    <div className="text-4xl font-bold text-gradient mb-2">24/7</div>
                                    <div className="text-sm opacity-80">Analysis Ready</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={() => scrollToSection('problems')}
                        className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce"
                    >
                        <ChevronDown className="w-8 h-8 text-primary" />
                    </button>
                </div>
            </section>

            {/* Problem Statement */}
            <section
                id="problems"
                data-animate
                className={`py-32 bg-gradient-to-b from-[#2d2d3a] to-[#4a4a5c] text-white transition-all duration-1000 ${isVisible['problems'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                    }`}
            >
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-5xl font-bold mb-4">The Firewall Management Challenge</h2>
                        <p className="text-xl text-white/70 max-w-2xl mx-auto">
                            Managing firewalls across multiple vendors shouldn't feel like rocket science
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {[
                            {
                                title: 'Complex Configurations',
                                description: 'Parsing and understanding thousands of firewall rules manually is time-consuming and error-prone.',
                                gradient: 'vendor-gradient-cisco'
                            },
                            {
                                title: 'Multi-Vendor Chaos',
                                description: 'Each vendor has different syntax, making cross-platform analysis a nightmare.',
                                gradient: 'vendor-gradient-paloalto'
                            },
                            {
                                title: 'Lack of Insights',
                                description: 'Without proper analytics, identifying unused rules and optimizing policies is nearly impossible.',
                                gradient: 'vendor-gradient-fortinet'
                            }
                        ].map((problem, idx) => (
                            <div
                                key={idx}
                                className="glass-dark rounded-2xl p-8 shadow-card hover:shadow-card-hover transition-all duration-500 animate-slide-up"
                                style={{ animationDelay: `${idx * 0.2}s` }}
                            >
                                <div className={`w-16 h-16 rounded-xl ${problem.gradient} flex items-center justify-center mb-6 animate-pulse-soft`}>
                                    <Shield className="w-8 h-8 text-white" />
                                </div>
                                <h3 className="text-2xl font-semibold mb-3">{problem.title}</h3>
                                <p className="text-white/70 leading-relaxed">{problem.description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section
                id="features"
                data-animate
                className={`py-32 transition-all duration-1000 ${isVisible['features'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                    }`}
            >
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-5xl font-bold mb-4">Powerful Features</h2>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            Everything you need to analyze, optimize, and manage your firewall infrastructure
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {[
                            {
                                icon: Upload,
                                title: 'Multi-Format Upload',
                                description: 'Support for configuration files, ZIP archives, and show commands from all major vendors.'
                            },
                            {
                                icon: Zap,
                                title: 'Automated Parsing',
                                description: 'Intelligent parsing engine that understands Cisco ASA, Palo Alto, FortiGate, and Checkpoint syntax.'
                            },
                            {
                                icon: BarChart3,
                                title: 'Deep Analytics',
                                description: 'Comprehensive insights into rule usage, hit counts, and traffic patterns.'
                            },
                            {
                                icon: GitCompare,
                                title: 'Change Tracking',
                                description: 'Monitor configuration changes over time with detailed comparison views.'
                            },
                            {
                                icon: FileText,
                                title: 'Rich Reports',
                                description: 'Generate professional reports with visualizations and actionable recommendations.'
                            },
                            {
                                icon: Clock,
                                title: 'Unused Rule Detection',
                                description: 'Automatically identify inactive rules to improve policy performance and security.'
                            }
                        ].map((feature, idx) => (
                            <div
                                key={idx}
                                className="glass rounded-2xl p-8 shadow-card hover:shadow-card-hover transition-all duration-500 group animate-scale-in"
                                style={{ animationDelay: `${idx * 0.1}s` }}
                            >
                                <div className="w-14 h-14 rounded-xl gradient-primary flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <feature.icon className="w-7 h-7 text-white" />
                                </div>
                                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                            </div>
                        ))}
                    </div>

                    {/* Vendor Logos */}
                    <div className="mt-20 text-center">
                        <p className="text-sm uppercase tracking-wider text-muted-foreground mb-8 font-semibold">
                            Supported Vendors
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-8">
                            {['Cisco ASA', 'Palo Alto', 'FortiGate', 'Check Point'].map((vendor, idx) => (
                                <div
                                    key={idx}
                                    className="px-6 py-3 glass rounded-xl font-semibold text-foreground hover:shadow-glow transition-all duration-300"
                                >
                                    {vendor}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* How It Works */}
            <section
                id="how-it-works"
                data-animate
                className={`py-32 bg-muted/30 transition-all duration-1000 ${isVisible['how-it-works'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                    }`}
            >
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-5xl font-bold mb-4">How It Works</h2>
                        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                            From upload to insights in four simple steps
                        </p>
                    </div>

                    <div className="relative">
                        {/* Connection Line */}
                        <div className="absolute top-1/2 left-0 right-0 h-1 bg-gradient-primary hidden lg:block -translate-y-1/2"></div>

                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 relative">
                            {[
                                {
                                    step: '01',
                                    icon: Upload,
                                    title: 'Upload Configuration',
                                    description: 'Upload your firewall config files, logs, or ZIP archives'
                                },
                                {
                                    step: '02',
                                    icon: Search,
                                    title: 'Automated Analysis',
                                    description: 'Our engine parses and analyzes your configuration automatically'
                                },
                                {
                                    step: '03',
                                    icon: TrendingUp,
                                    title: 'Generate Insights',
                                    description: 'Get detailed reports with usage statistics and recommendations'
                                },
                                {
                                    step: '04',
                                    icon: Download,
                                    title: 'Optimize & Export',
                                    description: 'Export cleaned configs and implement optimizations'
                                }
                            ].map((step, idx) => (
                                <div
                                    key={idx}
                                    className="relative animate-slide-up"
                                    style={{ animationDelay: `${idx * 0.2}s` }}
                                >
                                    <div className="glass rounded-2xl p-8 shadow-card hover:shadow-card-hover transition-all duration-500 h-full">
                                        <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mb-6 mx-auto shadow-glow">
                                            <step.icon className="w-8 h-8 text-white" />
                                        </div>
                                        <div className="text-5xl font-bold text-primary/20 mb-2 text-center">{step.step}</div>
                                        <h3 className="text-xl font-semibold mb-3 text-center">{step.title}</h3>
                                        <p className="text-muted-foreground text-center leading-relaxed">{step.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* Benefits */}
            <section
                id="benefits"
                data-animate
                className={`py-32 transition-all duration-1000 ${isVisible['benefits'] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
                    }`}
            >
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid lg:grid-cols-2 gap-16 items-center mb-20">
                        <div className="animate-slide-up">
                            <h2 className="text-4xl font-bold mb-6">Save Time with Automation</h2>
                            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                                What used to take hours or days now takes minutes. Our automated parsing engine handles the heavy lifting,
                                freeing you to focus on strategic decisions rather than manual configuration reviews.
                            </p>
                            <ul className="space-y-4">
                                {[
                                    'Parse thousands of rules in seconds',
                                    'Automated hit count analysis',
                                    'Instant policy optimization suggestions',
                                    'Batch processing for multiple devices'
                                ].map((benefit, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                                        <span className="text-foreground">{benefit}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        <div className="glass rounded-2xl p-4 shadow-glow animate-scale-in">
                            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-12 flex items-center justify-center">
                                <Clock className="w-48 h-48 text-primary animate-float" />
                            </div>
                        </div>
                    </div>

                    <div className="grid lg:grid-cols-2 gap-16 items-center">
                        <div className="glass rounded-2xl p-4 shadow-glow animate-scale-in order-2 lg:order-1">
                            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-12 flex items-center justify-center">
                                <BarChart3 className="w-48 h-48 text-primary animate-float" />
                            </div>
                        </div>
                        <div className="animate-slide-up order-1 lg:order-2">
                            <h2 className="text-4xl font-bold mb-6">Detailed Analytics & Reporting</h2>
                            <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
                                Gain unprecedented visibility into your firewall infrastructure with comprehensive analytics,
                                visual dashboards, and exportable reports that make compliance a breeze.
                            </p>
                            <ul className="space-y-4">
                                {[
                                    'Real-time traffic pattern analysis',
                                    'Historical change tracking',
                                    'Compliance-ready reports',
                                    'Visual policy mapping'
                                ].map((benefit, idx) => (
                                    <li key={idx} className="flex items-start gap-3">
                                        <CheckCircle2 className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
                                        <span className="text-foreground">{benefit}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-32 gradient-primary text-white relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-10 left-10 w-96 h-96 bg-white rounded-full blur-3xl animate-float"></div>
                    <div className="absolute bottom-10 right-10 w-72 h-72 bg-white rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }}></div>
                </div>

                <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                    <h2 className="text-5xl md:text-6xl font-bold mb-6 animate-slide-up">
                        Ready to Streamline Your Firewall Management?
                    </h2>
                    <p className="text-xl mb-10 text-white/90 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        Join teams who've saved hundreds of hours with automated firewall analysis
                    </p>
                    <div className="flex items-center justify-center gap-4 animate-scale-in" style={{ animationDelay: '0.4s' }}>
                        <Button
                            size="lg"
                            variant="secondary"
                            className="text-lg px-8 bg-white text-primary hover:bg-white/90"
                            onClick={() => navigate('/login')}
                        >
                            Get Started Free
                        </Button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-[#2d2d3a] text-white py-16">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-4 gap-12 mb-12">
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <Shield className="w-8 h-8 text-primary" />
                                <span className="text-xl font-bold">Firewall Analyzer</span>
                            </div>
                            <p className="text-white/60 text-sm leading-relaxed">
                                Simplifying firewall management and analysis for modern network teams.
                            </p>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-4">Product</h3>
                            <ul className="space-y-2 text-sm text-white/60">
                                <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
                                <li><a href="#how-it-works" className="hover:text-primary transition-colors">How It Works</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Pricing</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-4">Company</h3>
                            <ul className="space-y-2 text-sm text-white/60">
                                <li><a href="#" className="hover:text-primary transition-colors">About Us</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Blog</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Careers</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Contact</a></li>
                            </ul>
                        </div>

                        <div>
                            <h3 className="font-semibold mb-4">Legal</h3>
                            <ul className="space-y-2 text-sm text-white/60">
                                <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
                                <li><a href="#" className="hover:text-primary transition-colors">Security</a></li>
                            </ul>
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-8 text-center text-sm text-white/40">
                        <p>© 2026 Firewall Analyzer. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </div>
    );
}
