import React from 'react';
import RecommendationForm from './RecommendationForm.jsx';
import RecommendedSchemes from './RecommendedSchemes.jsx';
import { useLanguage } from '../context/LanguageContext';

function RecommendationPage({
  recommendations,
  rankedBy,
  isLoading,
  onRecommendations,
  onLoading,
}) {
  const { t } = useLanguage();

  return (
    <section id="recommendation" className="recommendation-section" style={{ minHeight: 'calc(100vh - 80px)' }}>
      <div className="recommendation-container">
        <div className="recommendation-header">
          <h2>{t('recSectionTitle')}</h2>
          <p>{t('recSectionSubtitle')}</p>
        </div>

        <div className="recommendation-content">
          <RecommendationForm
            onRecommendations={onRecommendations}
            onLoading={onLoading}
          />
          <RecommendedSchemes
            schemes={recommendations}
            isLoading={isLoading}
            rankedBy={rankedBy}
          />
        </div>
      </div>
    </section>
  );
}

export default RecommendationPage;
